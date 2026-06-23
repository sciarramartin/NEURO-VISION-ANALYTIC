try:
    import sys
    import cv2
    import mediapipe as mp
    import numpy as np
    import math
    import time
    import sqlite3
    from PyQt5.QtWidgets import (QApplication, QWidget, QLabel, QPushButton, 
        QHBoxLayout, QVBoxLayout, QTableWidget, QTableWidgetItem, QMessageBox, 
        QDialog, QFormLayout, QLineEdit, QDateEdit, QDialogButtonBox, QComboBox,
        QGroupBox, QRadioButton, QHeaderView, QCheckBox, QFileDialog, QSlider,
        QInputDialog)
    from PyQt5.QtCore import QTimer, Qt, QDate
    from PyQt5.QtGui import QImage, QPixmap, QFontDatabase
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    import xlsxwriter
except ImportError as e:
    print(f"Error importando módulos: {e}")
    print("Por favor, instale las dependencias necesarias usando:")
    print("pip install mediapipe opencv-python PyQt5 numpy matplotlib xlsxwriter")
    sys.exit(1)

# Configuración inicial
ANCHO_VENTANA = 640
ALTO_VENTANA = 480

# Inicializar MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Definir puntos faciales de interés
PUNTOS_FACIALES = {
    'CEJA': {
        'IZQUIERDA': [70, 63, 105],  # Puntos para ceja izquierda
        'DERECHA': [336, 296, 334],   # Puntos para ceja derecha
        'DESCRIPCION': 'Movimiento de cejas'
    },
    'PARPADO': {
        'IZQUIERDA': [159, 145, 133], # Puntos para párpado izquierdo
        'DERECHA': [386, 374, 362],    # Puntos para párpado derecho
        'DESCRIPCION': 'Apertura palpebral'
    },
    'BOCA': {
        'IZQUIERDA': [61, 291, 0],    # Puntos para lado izquierdo de boca
        'DERECHA': [291, 61, 17],     # Puntos para lado derecho de boca
        'DESCRIPCION': 'Simetría de la sonrisa'
    },
    'NARIZ': {
        'IZQUIERDA': [198, 420, 437], # Puntos para fosa nasal izquierda
        'DERECHA': [420, 198, 168],    # Puntos para fosa nasal derecha
        'DESCRIPCION': 'Movilidad nasal'
    }
}

# Estado de la aplicación
app_state = {
    'current_mode': None,
    'recording': False,
    'start_time': None,
    'data': {'PRE': [], 'POST': []},
    'magnitud_fourier': 1.0
}

def init_db():
    """Inicializar base de datos para mediciones faciales"""
    conn = sqlite3.connect('facial_angles.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS mediciones_faciales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modo TEXT,
        region TEXT,
        lado TEXT,
        tiempo_medicion REAL,
        angulos TEXT,
        angulo_min REAL,
        angulo_max REAL
    )''')
    conn.commit()
    conn.close()

def calcular_angulo(p1, p2, p3):
    """Calcula el ángulo entre tres puntos"""
    v1 = np.array([p1[0] - p2[0], p1[1] - p2[1]])
    v2 = np.array([p3[0] - p2[0], p3[1] - p2[1]])
    
    coseno = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    angulo = np.arccos(np.clip(coseno, -1.0, 1.0))
    return np.degrees(angulo)

class SeleccionRegionDialog(QDialog):
    """Diálogo para seleccionar la región facial a analizar"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Configuración de Medición Facial")
        self.setup_ui()
        self.seleccion = None

    def setup_ui(self):
        layout = QVBoxLayout()
        
        # Grupo de región facial
        grupo_region = QGroupBox("Seleccione la región facial")
        region_layout = QVBoxLayout()
        self.combo_region = QComboBox()
        self.combo_region.addItems(PUNTOS_FACIALES.keys())
        self.combo_region.currentTextChanged.connect(self.actualizar_descripcion)
        region_layout.addWidget(self.combo_region)
        self.lbl_descripcion = QLabel()
        region_layout.addWidget(self.lbl_descripcion)
        grupo_region.setLayout(region_layout)
        
        # Grupo de lado
        grupo_lado = QGroupBox("Seleccione el lado")
        lado_layout = QHBoxLayout()
        self.radio_derecha = QRadioButton("Derecha")
        self.radio_izquierda = QRadioButton("Izquierda")
        self.radio_derecha.setChecked(True)
        lado_layout.addWidget(self.radio_derecha)
        lado_layout.addWidget(self.radio_izquierda)
        grupo_lado.setLayout(lado_layout)
        
        # Botones
        botones = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal, self)
        botones.accepted.connect(self.accept)
        botones.rejected.connect(self.reject)
        
        layout.addWidget(grupo_region)
        layout.addWidget(grupo_lado)
        layout.addWidget(botones)
        self.setLayout(layout)
        self.actualizar_descripcion(self.combo_region.currentText())

    def actualizar_descripcion(self, region):
        self.lbl_descripcion.setText(PUNTOS_FACIALES[region]['DESCRIPCION'])

    def accept(self):
        self.seleccion = {
            'region': self.combo_region.currentText(),
            'lado': 'DERECHA' if self.radio_derecha.isChecked() else 'IZQUIERDA'
        }
        super().accept()

class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Análisis Facial")
        self.init_camera()
        self.init_ui()
        self.init_timers()
        self.update_table()
        
    def init_camera(self):
        try:
            # Intentar abrir primero la cámara USB
            self.cap = cv2.VideoCapture(1)
            if not self.cap.isOpened():
                print("No se pudo abrir la cámara USB, intentando webcam...")
                self.cap.release()
                self.cap = cv2.VideoCapture(0)
                
            if not self.cap.isOpened():
                raise Exception("No se pudo abrir ninguna cámara")
                
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO_VENTANA)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO_VENTANA)
            print("Cámara inicializada correctamente")
            
        except Exception as e:
            print(f"Error inicializando la cámara: {e}")
            QMessageBox.critical(self, "Error", f"No se pudo abrir ninguna cámara: {str(e)}")
            sys.exit(1)

    def init_ui(self):
        layout = QVBoxLayout()
        
        # Panel de cámaras con mismo tamaño
        cameras_layout = QHBoxLayout()
        self.lbl_camera = QLabel()
        self.lbl_landmarks = QLabel()  # Nueva label para landmarks
        
        # Fijar tamaño mínimo para ambas labels
        min_size = 400
        self.lbl_camera.setMinimumSize(min_size, min_size)
        self.lbl_landmarks.setMinimumSize(min_size, min_size)
        
        cameras_layout.addWidget(self.lbl_camera)
        cameras_layout.addWidget(self.lbl_landmarks)
        layout.addLayout(cameras_layout)
        
        # Controles
        btn_layout = QHBoxLayout()
        self.btn_pre = QPushButton("PRE")
        self.btn_post = QPushButton("POST")
        self.btn_run = QPushButton("RUN")
        self.btn_stop = QPushButton("STOP")
        self.btn_config = QPushButton("CONFIGURAR")
        self.btn_comparar = QPushButton("COMPARAR")
        self.btn_magnitud = QPushButton("MAGNITUD")
        self.btn_pdf = QPushButton("EXPORTAR PDF")
        self.btn_excel = QPushButton("EXPORTAR EXCEL")
        
        for btn in [self.btn_pre, self.btn_post, self.btn_run, 
                   self.btn_stop, self.btn_config, self.btn_comparar,
                   self.btn_magnitud, self.btn_pdf, self.btn_excel]:
            btn_layout.addWidget(btn)
            
        layout.addLayout(btn_layout)
        
        # Tabla de resultados
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels([
            "Seleccionar", "Modo", "Región", "Lado", 
            "Rango (min-max)", "Tiempo (s)"
        ])
        layout.addWidget(self.table)
        
        # Agregar label para cronómetro
        self.lbl_cronometro = QLabel("00:00:00")
        self.lbl_cronometro.setStyleSheet("""
            QLabel {
                font-size: 24px;
                color: #00aae4;
                padding: 10px;
            }
        """)
        self.lbl_cronometro.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.lbl_cronometro)
        
        self.setLayout(layout)
        
        # Conectar eventos
        self.btn_pre.clicked.connect(lambda: self.set_mode('PRE'))
        self.btn_post.clicked.connect(lambda: self.set_mode('POST'))
        self.btn_run.clicked.connect(self.iniciar_medicion)
        self.btn_stop.clicked.connect(self.detener_medicion)
        self.btn_config.clicked.connect(self.configurar_medicion)
        self.btn_comparar.clicked.connect(self.comparar_mediciones)
        self.btn_magnitud.clicked.connect(self.configurar_magnitud)
        self.btn_pdf.clicked.connect(self.exportar_pdf)
        self.btn_excel.clicked.connect(self.exportar_excel)
        
        # Estilo
        self.setStyleSheet("""
            QWidget {
                background-color: #121212;
                color: #E0E0E0;
                font-family: 'Inconsolata', monospace;
            }
            QPushButton {
                background-color: #1E1E1E;
                color: #00aae4;
                border: 2px solid #00aae4;
                border-radius: 4px;
                padding: 8px;
                font-size: 14px;
                min-width: 100px;
            }
            QPushButton:hover {
                background-color: #00aae4;
                color: white;
            }
            QTableWidget {
                border: 1px solid #424242;
                background-color: #1E1E1E;
            }
            QHeaderView::section {
                background-color: #212121;
                color: #00aae4;
                padding: 4px;
                border: none;
            }
        """)

        # Ajustar la tabla para que ocupe todo el ancho
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Fixed)  # Columna checkbox
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)  # Modo
        header.setSectionResizeMode(2, QHeaderView.Stretch)  # Región
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)  # Lado
        header.setSectionResizeMode(4, QHeaderView.Stretch)  # Rango
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)  # Tiempo
        
        # Establecer anchos específicos
        self.table.setColumnWidth(0, 80)  # Checkbox

    def init_timers(self):
        # Timer para la cámara
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(30)
        
        # Timer para el cronómetro
        self.crono_timer = QTimer()
        self.crono_timer.timeout.connect(self.actualizar_cronometro)
        self.crono_inicio = None

    def update_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return
        
        # Convertir a RGB para MediaPipe
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(frame_rgb)
        
        # Crear frame negro para landmarks
        frame_landmarks = np.zeros_like(frame)
        
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                # Dibujar landmarks en ambos frames
                for idx, landmark in enumerate(face_landmarks.landmark):
                    x = int(landmark.x * frame.shape[1])
                    y = int(landmark.y * frame.shape[0])
                    # Dibujar en frame original
                    cv2.circle(frame, (x, y), 1, (228, 170, 0), -1)
                    # Dibujar en frame negro
                    cv2.circle(frame_landmarks, (x, y), 1, (0, 170, 228), -1)
                
                # Si hay una región seleccionada, dibujar sus puntos específicos
                if hasattr(self, 'config_medicion'):
                    region = self.config_medicion['region']
                    lado = self.config_medicion['lado']
                    puntos = PUNTOS_FACIALES[region][lado]
                    
                    # Dibujar puntos de interés más grandes en ambos frames
                    for idx in puntos:
                        landmark = face_landmarks.landmark[idx]
                        x = int(landmark.x * frame.shape[1])
                        y = int(landmark.y * frame.shape[0])
                        # Frame original
                        cv2.circle(frame, (x, y), 2, (0, 170, 228), -1)
                        # Frame negro
                        cv2.circle(frame_landmarks, (x, y), 2, (0, 170, 228), -1)
                        
                        # Conectar puntos con líneas en frame negro
                        if len(puntos) == 3:  # Si tenemos tres puntos para formar un ángulo
                            pts = np.array([[int(face_landmarks.landmark[p].x * frame.shape[1]),
                                           int(face_landmarks.landmark[p].y * frame.shape[0])] 
                                          for p in puntos], np.int32)
                            cv2.polylines(frame_landmarks, [pts], True, (0, 170, 228), 1)
        
        # Convertir y mostrar ambas imágenes
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        landmarks_rgb = cv2.cvtColor(frame_landmarks, cv2.COLOR_BGR2RGB)
        
        h, w, ch = frame_rgb.shape
        
        img_camera = QImage(frame_rgb.data, w, h, w * ch, QImage.Format_RGB888)
        img_landmarks = QImage(landmarks_rgb.data, w, h, w * ch, QImage.Format_RGB888)
        
        self.lbl_camera.setPixmap(QPixmap.fromImage(img_camera).scaled(
            self.lbl_camera.width(), self.lbl_camera.height(), 
            Qt.KeepAspectRatio))
        self.lbl_landmarks.setPixmap(QPixmap.fromImage(img_landmarks).scaled(
            self.lbl_landmarks.width(), self.lbl_landmarks.height(), 
            Qt.KeepAspectRatio))
        
        if results.multi_face_landmarks and app_state['recording'] and hasattr(self, 'config_medicion'):
            face_landmarks = results.multi_face_landmarks[0]
            region = self.config_medicion['region']
            lado = self.config_medicion['lado']
            puntos = PUNTOS_FACIALES[region][lado]
            
            if len(puntos) == 3:
                # Obtener coordenadas de los tres puntos
                pts = [[face_landmarks.landmark[p].x * frame.shape[1],
                       face_landmarks.landmark[p].y * frame.shape[0]]
                      for p in puntos]
                
                # Calcular ángulo
                angulo = calcular_angulo(pts[0], pts[1], pts[2])
                
                # Guardar tiempo y ángulo
                tiempo_actual = time.time() - app_state['start_time']
                app_state['data'][app_state['current_mode']].append((tiempo_actual, angulo))

    def set_mode(self, modo):
        app_state['current_mode'] = modo
        self.btn_pre.setStyleSheet("""
            QPushButton {
                background-color: #00aae4;
                color: white;
            }
        """ if modo == 'PRE' else "")
        self.btn_post.setStyleSheet("""
            QPushButton {
                background-color: #00aae4;
                color: white;
            }
        """ if modo == 'POST' else "")

    def configurar_medicion(self):
        dialogo = SeleccionRegionDialog(self)
        if dialogo.exec_():
            self.config_medicion = dialogo.seleccion
            self.setWindowTitle(f"Análisis Facial - {self.config_medicion['region']} {self.config_medicion['lado']}")

    def actualizar_cronometro(self):
        if self.crono_inicio is None:
            self.lbl_cronometro.setText("00:00:00")
            return
        
        elapsed = time.time() - self.crono_inicio
        minutos = int(elapsed // 60)
        segundos = int(elapsed % 60)
        milis = int((elapsed - int(elapsed)) * 100)
        self.lbl_cronometro.setText(f"{minutos:02d}:{segundos:02d}:{milis:02d}")

    def iniciar_medicion(self):
        if not hasattr(self, 'config_medicion'):
            QMessageBox.warning(self, "Atención", "Primero configure la región a medir.")
            return
        
        if not app_state['current_mode']:
            QMessageBox.warning(self, "Atención", "Seleccione PRE o POST primero.")
            return
            
        app_state['recording'] = True
        app_state['start_time'] = time.time()
        app_state['data'][app_state['current_mode']] = []
        
        # Iniciar cronómetro
        self.crono_inicio = time.time()
        self.crono_timer.start(10)  # Actualizar cada 10ms
        
        # Cambiar estilo del botón RUN
        self.btn_run.setStyleSheet("""
            QPushButton {
                background-color: #1DB954;
                color: white;
                border: none;
            }
        """)

    def detener_medicion(self):
        try:
            if not app_state['recording']:
                return
            
            app_state['recording'] = False
            self.crono_timer.stop()
            self.crono_inicio = None
            self.lbl_cronometro.setText("00:00:00")
            
            # Restaurar estilo del botón RUN
            self.btn_run.setStyleSheet("")
            
            # Guardar datos si hay suficientes
            modo = app_state['current_mode']
            if modo and app_state['data'][modo] and len(app_state['data'][modo]) > 2:
                self.guardar_medicion()
                self.update_table()
            else:
                QMessageBox.warning(self, "Atención", 
                                  "No hay suficientes datos para guardar.")
            
        except Exception as e:
            print(f"Error al detener medición: {e}")
            QMessageBox.critical(self, "Error", 
                             "Ocurrió un error al detener la medición.")

    def guardar_medicion(self):
        modo = app_state['current_mode']
        tiempo_total = time.time() - app_state['start_time']
        angulos = [ang for _, ang in app_state['data'][modo]]
        
        if not angulos:
            return
            
        angulos_str = ";".join(map(str, angulos))
        angulo_min = min(angulos)
        angulo_max = max(angulos)
        
        conn = sqlite3.connect('facial_angles.db')
        c = conn.cursor()
        c.execute("""INSERT INTO mediciones_faciales 
                    (modo, region, lado, tiempo_medicion, angulos, angulo_min, angulo_max)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                  (modo, self.config_medicion['region'], self.config_medicion['lado'],
                   tiempo_total, angulos_str, angulo_min, angulo_max))
        conn.commit()
        conn.close()

    def update_table(self):
        try:
            self.table.setRowCount(0)
            conn = sqlite3.connect('facial_angles.db')
            c = conn.cursor()
            c.execute("SELECT id, modo, region, lado, angulo_min, angulo_max, tiempo_medicion FROM mediciones_faciales")
            rows = c.fetchall()
            conn.close()
            
            for row in rows:
                id_, modo, region, lado, ang_min, ang_max, tiempo = row
                row_idx = self.table.rowCount()
                self.table.insertRow(row_idx)
                
                # Checkbox para seleccionar
                chk = QCheckBox()
                chk.setProperty("db_id", id_)
                # Centrar checkbox
                chk_widget = QWidget()
                chk_layout = QHBoxLayout(chk_widget)
                chk_layout.addWidget(chk)
                chk_layout.setAlignment(Qt.AlignCenter)
                chk_layout.setContentsMargins(0, 0, 0, 0)
                self.table.setCellWidget(row_idx, 0, chk_widget)
                
                self.table.setItem(row_idx, 1, QTableWidgetItem(modo))
                self.table.setItem(row_idx, 2, QTableWidgetItem(region))
                self.table.setItem(row_idx, 3, QTableWidgetItem(lado))
                self.table.setItem(row_idx, 4, QTableWidgetItem(f"{ang_min:.1f}° - {ang_max:.1f}°"))
                self.table.setItem(row_idx, 5, QTableWidgetItem(f"{tiempo:.1f}"))
        except Exception as e:
            print(f"Error al actualizar tabla: {e}")

    def comparar_mediciones(self):
        pre_selected = []
        post_selected = []
        
        for i in range(self.table.rowCount()):
            # Obtener el widget contenedor y extraer el checkbox
            chk_widget = self.table.cellWidget(i, 0)
            if chk_widget:
                chk = chk_widget.findChild(QCheckBox)
                if chk and chk.isChecked():
                    modo = self.table.item(i, 1).text()
                    region = self.table.item(i, 2).text()
                    lado = self.table.item(i, 3).text()
                    rango = self.table.item(i, 4).text()
                    ang_min, ang_max = map(float, rango.replace('°', '').split(' - '))
                    
                    medicion = {
                        'region': region,
                        'lado': lado,
                        'rango': ang_max - ang_min
                    }
                    
                    if modo == 'PRE':
                        pre_selected.append(medicion)
                    elif modo == 'POST':
                        post_selected.append(medicion)
        
        if not pre_selected or not post_selected:
            QMessageBox.warning(self, "Atención", 
                              "Selecciona al menos una medición PRE y una POST para comparar")
            return
        
        pre_rango = sum(p['rango'] for p in pre_selected) / len(pre_selected)
        post_rango = sum(p['rango'] for p in post_selected) / len(post_selected)
        diff_abs = post_rango - pre_rango
        diff_porc = (diff_abs / pre_rango) * 100 if pre_rango > 0 else 0
        
        mensaje = f"""Resultados de la comparación:

Rango de movimiento promedio:
PRE: {pre_rango:.1f}°
POST: {post_rango:.1f}°

Diferencia absoluta: {diff_abs:+.1f}°
Diferencia porcentual: {diff_porc:+.1f}%"""
        
        QMessageBox.information(self, "Resultados de Comparación", mensaje)

    def configurar_magnitud(self):
        val, ok = QInputDialog.getDouble(
            self, "Configurar Magnitud", 
            "Magnitud Fourier:", 
            app_state['magnitud_fourier'], 0.0, 100.0, 2
        )
        if ok:
            app_state['magnitud_fourier'] = val

    def exportar_pdf(self):
        filename, _ = QFileDialog.getSaveFileName(self, "Exportar PDF", "", "PDF Files (*.pdf)")
        if not filename:
            return
            
        selected_ids = []
        for i in range(self.table.rowCount()):
            chk_widget = self.table.cellWidget(i, 0)
            if chk_widget:
                chk = chk_widget.findChild(QCheckBox)
                if chk and chk.isChecked():
                    selected_ids.append(chk.property("db_id"))
                
        if not selected_ids:
            QMessageBox.warning(self, "Atención", "Seleccione al menos una medición para exportar.")
            return
            
        try:
            conn = sqlite3.connect('facial_angles.db')
            c = conn.cursor()
            
            with PdfPages(filename) as pdf:
                for db_id in selected_ids:
                    c.execute("SELECT modo, region, lado, angulos, tiempo_medicion FROM mediciones_faciales WHERE id = ?", (db_id,))
                    row = c.fetchone()
                    if not row:
                        continue
                    modo, region, lado, angulos_str, tiempo_total = row
                    if not angulos_str:
                        continue
                    angulos = list(map(float, angulos_str.split(';')))
                    
                    plt.figure(figsize=(8, 6))
                    tiempos = np.linspace(0, tiempo_total, len(angulos))
                    plt.plot(tiempos, angulos, label=f"{modo} - {region} {lado}", color='#00aae4')
                    plt.xlabel("Tiempo (s)")
                    plt.ylabel("Ángulo (°)")
                    plt.title(f"Medición Facial - {region} {lado} ({modo})")
                    plt.legend()
                    plt.grid(True)
                    
                    pdf.savefig()
                    plt.close()
                    
            conn.close()
            QMessageBox.information(self, "Éxito", f"PDF exportado correctamente a:\n{filename}")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Error al exportar PDF: {str(e)}")

    def exportar_excel(self):
        filename, _ = QFileDialog.getSaveFileName(self, "Exportar Excel", "", "Excel Files (*.xlsx)")
        if not filename:
            return
            
        selected_ids = []
        for i in range(self.table.rowCount()):
            chk_widget = self.table.cellWidget(i, 0)
            if chk_widget:
                chk = chk_widget.findChild(QCheckBox)
                if chk and chk.isChecked():
                    selected_ids.append(chk.property("db_id"))
                
        if not selected_ids:
            QMessageBox.warning(self, "Atención", "Seleccione al menos una medición para exportar.")
            return
            
        try:
            workbook = xlsxwriter.Workbook(filename)
            worksheet = workbook.add_worksheet("Mediciones")
            
            headers = ["ID", "Modo", "Región", "Lado", "Tiempo Total (s)", "Ángulo Mín (°)", "Ángulo Máx (°)"]
            for col_num, header in enumerate(headers):
                worksheet.write(0, col_num, header)
                
            conn = sqlite3.connect('facial_angles.db')
            c = conn.cursor()
            
            row_num = 1
            for db_id in selected_ids:
                c.execute("SELECT modo, region, lado, tiempo_medicion, angulo_min, angulo_max, angulos FROM mediciones_faciales WHERE id = ?", (db_id,))
                res = c.fetchone()
                if not res:
                    continue
                modo, region, lado, tiempo_total, ang_min, ang_max, angulos_str = res
                
                worksheet.write(row_num, 0, db_id)
                worksheet.write(row_num, 1, modo)
                worksheet.write(row_num, 2, region)
                worksheet.write(row_num, 3, lado)
                worksheet.write(row_num, 4, tiempo_total)
                worksheet.write(row_num, 5, ang_min)
                worksheet.write(row_num, 6, ang_max)
                
                if angulos_str:
                    details_sheet = workbook.add_worksheet(f"Detalle_Medicion_{db_id}")
                    details_sheet.write(0, 0, "Tiempo (s)")
                    details_sheet.write(0, 1, "Ángulo (°)")
                    angulos = list(map(float, angulos_str.split(';')))
                    tiempos = np.linspace(0, tiempo_total, len(angulos))
                    for idx, (t, a) in enumerate(zip(tiempos, angulos)):
                        details_sheet.write(idx + 1, 0, t)
                        details_sheet.write(idx + 1, 1, a)
                        
                row_num += 1
                
            conn.close()
            workbook.close()
            QMessageBox.information(self, "Éxito", f"Excel exportado correctamente a:\n{filename}")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Error al exportar Excel: {str(e)}")

if __name__ == '__main__':
    init_db()
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())
