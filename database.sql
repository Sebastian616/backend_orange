-- ============================================================
-- Script de base de datos: Ecommerce de ropa deportiva para dama
-- Motor: PostgreSQL
-- ============================================================

-- Extensión para generar UUIDs (opcional, alternativa a SERIAL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------

CREATE TYPE rol_usuario AS ENUM ('CLIENTE', 'ADMIN');

CREATE TYPE estado_pedido AS ENUM (
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO'
);

-- ---------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------

CREATE TABLE usuarios (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            VARCHAR(150) NOT NULL,
  correo            VARCHAR(150) NOT NULL UNIQUE,
  whatsapp          VARCHAR(20) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  rol               rol_usuario NOT NULL DEFAULT 'CLIENTE',
  correo_verificado BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE direcciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alias         VARCHAR(50) NOT NULL,      -- "Casa", "Trabajo"
  direccion     TEXT NOT NULL,
  ciudad        VARCHAR(100) NOT NULL,
  departamento  VARCHAR(100),
  referencia    TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- CATÁLOGO: CATEGORÍAS, PRODUCTOS Y TALLAS
-- ---------------------------------------------------------------

CREATE TABLE categorias (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE productos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(200) NOT NULL,
  descripcion   TEXT,
  precio        NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  etiqueta      VARCHAR(50),               -- "nuevo", "oferta", "más vendido"
  categoria_id  UUID REFERENCES categorias(id),
  fotos         TEXT[] NOT NULL DEFAULT '{}',  -- urls de Cloudinary
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE tallas (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  VARCHAR(10) NOT NULL UNIQUE   -- "XS", "S", "M", "L", "XL"
);

-- Relación producto <-> talla, con stock independiente por talla
CREATE TABLE producto_tallas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  talla_id     UUID NOT NULL REFERENCES tallas(id),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (producto_id, talla_id)
);

-- ---------------------------------------------------------------
-- PEDIDOS
-- ---------------------------------------------------------------

CREATE TABLE pedidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id),
  direccion_id  UUID REFERENCES direcciones(id),
  subtotal      NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  costo_envio   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo_envio >= 0),
  total         NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  estado        estado_pedido NOT NULL DEFAULT 'PENDIENTE',
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- Detalle de cada producto dentro de un pedido
CREATE TABLE pedido_detalle (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id      UUID NOT NULL REFERENCES productos(id),
  talla_id         UUID NOT NULL REFERENCES tallas(id),
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)  -- precio "congelado" al comprar
);

-- Trazabilidad de cambios de estado (tracking del pedido)
CREATE TABLE historial_estado_pedido (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado      estado_pedido NOT NULL,
  comentario  TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- EXTRAS: RESEÑAS Y FAVORITOS
-- ---------------------------------------------------------------

CREATE TABLE resenas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  calificacion  SMALLINT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario    TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, producto_id)
);

CREATE TABLE favoritos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto_id  UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, producto_id)
);

-- ---------------------------------------------------------------
-- ÍNDICES ÚTILES (búsquedas frecuentes)
-- ---------------------------------------------------------------

CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedido_detalle_pedido ON pedido_detalle(pedido_id);

-- ---------------------------------------------------------------
-- DATOS BASE (seed): tallas y categorías
-- ---------------------------------------------------------------

INSERT INTO tallas (nombre) VALUES ('XS'), ('S'), ('M'), ('L'), ('XL');

INSERT INTO categorias (nombre)
VALUES ('Leggings'), ('Tops'), ('Conjuntos'), ('Chaquetas'), ('Accesorios');