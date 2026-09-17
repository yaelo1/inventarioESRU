PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  testament TEXT NOT NULL CHECK (testament IN ('AT', 'NT')),
  number INTEGER NOT NULL CHECK (number > 0),
  name TEXT NOT NULL,
  consecutive_range TEXT,
  box TEXT,
  drawer TEXT,
  total_pieces_reported INTEGER CHECK (total_pieces_reported >= 0),
  restoration_required INTEGER NOT NULL DEFAULT 0 CHECK (restoration_required IN (0, 1)),
  observations TEXT,
  loan_summary TEXT,
  showcase TEXT,
  maquette_box TEXT,
  image_path TEXT,
  original_image_path TEXT,
  thumbnail_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (testament, number)
);

CREATE TABLE IF NOT EXISTS showcases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  section TEXT,
  support_type TEXT NOT NULL DEFAULT 'Vitrina',
  shape TEXT NOT NULL DEFAULT 'rectangular'
    CHECK (shape IN ('rectangular', 'circular', 'irregular', 'otro')),
  length_cm REAL CHECK (length_cm IS NULL OR length_cm > 0),
  width_cm REAL CHECK (width_cm IS NULL OR width_cm > 0),
  height_cm REAL CHECK (height_cm IS NULL OR height_cm > 0),
  diameter_cm REAL CHECK (diameter_cm IS NULL OR diameter_cm > 0),
  measurement_notes TEXT,
  location TEXT,
  observations TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS showcase_passages (
  showcase_id INTEGER NOT NULL,
  passage_id INTEGER NOT NULL UNIQUE,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (showcase_id, passage_id),
  FOREIGN KEY (showcase_id) REFERENCES showcases(id) ON DELETE CASCADE,
  FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pieces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id INTEGER NOT NULL,
  internal_code TEXT NOT NULL UNIQUE,
  registry_number TEXT,
  global_number INTEGER,
  piece_number INTEGER,
  consecutive_number INTEGER,
  name TEXT NOT NULL,
  artist TEXT,
  box TEXT,
  drawer TEXT,
  showcase TEXT,
  exhibition_location TEXT,
  custodian TEXT,
  never_leaves_box INTEGER NOT NULL DEFAULT 0 CHECK (never_leaves_box IN (0, 1)),
  presence_status TEXT NOT NULL DEFAULT 'sin_confirmar'
    CHECK (presence_status IN ('en_caja', 'no_en_caja', 'en_vitrina', 'en_uso', 'prestada', 'en_mantenimiento', 'no_localizada', 'sin_confirmar')),
  condition_status TEXT NOT NULL DEFAULT 'sin_revisar'
    CHECK (condition_status IN ('bueno', 'regular', 'roto', 'requiere_mantenimiento', 'en_mantenimiento', 'sin_revisar')),
  maintenance_required INTEGER NOT NULL DEFAULT 0 CHECK (maintenance_required IN (0, 1)),
  material TEXT,
  deep TEXT,
  length TEXT,
  height TEXT,
  observations TEXT,
  loan_notes TEXT,
  is_loan_related INTEGER NOT NULL DEFAULT 0 CHECK (is_loan_related IN (0, 1)),
  image_path TEXT,
  original_image_path TEXT,
  thumbnail_path TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS piece_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  piece_id INTEGER NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('ingreso', 'salida', 'uso', 'prestamo', 'devolucion', 'traslado', 'mantenimiento', 'cambio_estado', 'ajuste')),
  from_presence_status TEXT,
  to_presence_status TEXT,
  from_condition_status TEXT,
  to_condition_status TEXT,
  responsible TEXT,
  counterparty TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (piece_id) REFERENCES pieces(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  piece_id INTEGER NOT NULL,
  loaned_to_passage_id INTEGER,
  loaned_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'devuelto', 'cancelado')),
  checkout_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_return_date TEXT,
  returned_at TEXT,
  responsible_out TEXT,
  responsible_in TEXT,
  notes TEXT,
  return_notes TEXT,
  FOREIGN KEY (piece_id) REFERENCES pieces(id) ON DELETE RESTRICT,
  FOREIGN KEY (loaned_to_passage_id) REFERENCES passages(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS piece_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  piece_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  thumbnail_path TEXT,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (piece_id) REFERENCES pieces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exhibition_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  piece_id INTEGER NOT NULL,
  target_passage_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'seleccionada'
    CHECK (status IN ('seleccionada', 'sacada', 'montada', 'finalizada', 'cancelada')),
  requested_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (piece_id) REFERENCES pieces(id) ON DELETE RESTRICT,
  FOREIGN KEY (target_passage_id) REFERENCES passages(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS maquettes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  box TEXT,
  total_pieces INTEGER NOT NULL DEFAULT 0 CHECK (total_pieces >= 0),
  restoration_required INTEGER NOT NULL DEFAULT 0 CHECK (restoration_required IN (0, 1)),
  material TEXT,
  observations TEXT,
  deep TEXT,
  length TEXT,
  height TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador', 'consulta')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_passages_testament_number ON passages(testament, number);
CREATE INDEX IF NOT EXISTS idx_showcases_code ON showcases(code);
CREATE INDEX IF NOT EXISTS idx_showcase_passages_showcase ON showcase_passages(showcase_id);
CREATE INDEX IF NOT EXISTS idx_pieces_passage ON pieces(passage_id);
CREATE INDEX IF NOT EXISTS idx_pieces_presence ON pieces(presence_status);
CREATE INDEX IF NOT EXISTS idx_pieces_condition ON pieces(condition_status);
CREATE INDEX IF NOT EXISTS idx_piece_movements_piece ON piece_movements(piece_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loans_piece_status ON loans(piece_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_active_piece
  ON loans(piece_id)
  WHERE status = 'activo';
CREATE INDEX IF NOT EXISTS idx_exhibition_picks_target ON exhibition_picks(target_passage_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exhibition_picks_active_piece
  ON exhibition_picks(piece_id)
  WHERE status IN ('seleccionada', 'sacada', 'montada');
CREATE INDEX IF NOT EXISTS idx_maquettes_box ON maquettes(box);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
