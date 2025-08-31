# Proyecto React+TS + PHP Slim 4 + Supabase

Aplicación web para hosting compartido con frontend React+TypeScript build estático y API REST en PHP Slim 4, usando Supabase como base de datos.

## Arquitectura

- **Frontend**: React + TypeScript (build con Vite)
- **Backend**: PHP 8.2 + Slim 4 framework
- **DB**: Supabase (Postgres con RLS)
- **Hosting**: cPanel / Apache compartido

### Estructura de Directorios

```
public_html/
  .htaccess          # Reglas Apache (HTTPS, API routing, SPA fallback)
  app/               # Build de React (subida aquí)
    index.html
    assets/
  api/               # Código PHP backend
    index.php        # Slim bootstrap
    .env             # Variables Supabase (no subir a repo)
    composer.json
    src/
      routes.php
  vendor/            # Dependencies composer

frontend/            # Source del frontend
  src/
  public/
  package.json
  vite.config.ts

.gitignore
README.md
```

## Instalación y Setup

### 1. Instalación de Dependencias

#### Frontend
```bash
cd frontend
npm install
```

#### Backend (si local)
```bash
cd public_html/api
composer install
```

### 2. Variables de Entorno

Crear `.env` en `public_html/api/.env` con:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_REST_URL=https://your-project.supabase.co/rest/v1
SUPABASE_ANON_PUBLIC=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
APP_ENV=prod
```

(Quitar del `.gitignore` si necesitas track el template)

### 3. Desarrollo Local

#### Frontend
```bash
cd frontend
npm run dev
```

#### Backend
Asegurarse de que Apache/PHP esté corriendo, acceder a `/api/`

### 4. Build y Despliegue

#### Build Frontend
```bash
cd frontend
npm run build  # Output to ../public_html/app
```

#### Instalar Vendor para Hosting
En hosting compartido, subir `api/` y hacer:
```bash
cd public_html/api
composer install --no-dev --optimize-autoloader
# Mover vendor/ a ../vendor/
```

#### Subida al Hosting
Subir todo `public_html/` al directorio `public_html` del hosting.

Asegurar que `.htaccess` esté habilitado para routing.

### 5. Endpoints API

- `GET /api/` - Health check
- `GET /api/health` - Status
- Rutas adicionales en `public_html/api/src/routes.php`

### 6. Seguridad

- JWT de usuarios válidos mediante Supabase JWKS
- RLS aplicado en todas las queries a Supabase
- Service key solo para endpoints admin
- HTTPS forzado en `.htaccess`
- Headers de seguridad en Slim middleware

## Notas

- Proyecto configurado para `/` como root de hosting (app y api en subdirs)
- Substituir `<your-project>` con tu project de Supabase
- Para local dev, ajustar CORS en `routes.php`
- Logs en hosting: configurar syslog o archivo fuera de public_html