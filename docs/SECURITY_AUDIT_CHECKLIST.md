# Security Audit Checklist

Usa esta checklist cuando se solicite una auditoria tecnica o de seguridad del sistema.

## Medidas base

- Revisar control de acceso por rol en endpoints administrativos y operativos.
- Verificar que secretos y tokens no se expongan en vistas, logs ni respuestas JSON.
- Confirmar que archivos sensibles esten fuera de `public/`.
- Validar politicas de permisos para documentos, proyectos, trabajadores y acciones destructivas.
- Revisar endurecimiento del worker y de credenciales de integraciones externas.

## Medida obligatoria: sesion tecnica de NotebookLM

Incluir siempre una revision especifica del canal NotebookLM cuando exista la integracion activa.

### Verificar

- Que la cookie/sesion de NotebookLM este separada de la sesion de usuarios Laravel.
- Que el archivo de cookies quede almacenado fuera de `public/`.
- Que la cuenta usada sea tecnica/corporativa y no una cuenta personal.
- Que el endpoint de estado de NotebookLM sea solo para administradores.
- Que no se expongan rutas sensibles completas o detalles innecesarios en la UI.
- Que el runtime del worker tenga permisos restringidos.
- Que el archivo `cookies.json` tenga permisos minimos recomendados y directorio protegido.
- Que exista procedimiento de renovacion y validacion de sesion vencida.

### Riesgos a reportar si aparecen

- Cookie reutilizable por otros procesos o usuarios del servidor.
- Rutas del runtime o del archivo de cookies visibles para perfiles no administradores.
- Credenciales o tokens presentes en logs, backups o archivos versionados.
- Dependencia de una sesion local sin monitoreo ni proceso de renovacion.

### Recomendacion minima esperada

- Directorio de runtime con permisos `700`.
- Archivo de cookies con permisos `600`.
- Usuario Linux dedicado para el worker.
- Cuenta tecnica exclusiva para NotebookLM.
- Monitoreo del estado de sesion y alerta de renovacion.
