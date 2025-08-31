# Diagrama de Topología Lógica

```mermaid
graph TD
    U[Usuario] -->|HTTPS| A[Apache/cPanel]
    A -->|/app/*| S[SPA React Estática<br/>index.html<br/>assets/]
    A -->|/api/*| B[API PHP Slim 4<br/>index.php<br/>routes.php]
    B -->|JWT Usuario| SB[(Supabase RLS/PostgREST)]
    B -->|Service Key| SB
    SB -->|Postgres| D[(Datos con RLS)]