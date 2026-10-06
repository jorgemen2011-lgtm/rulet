# Política de seguridad

## Versiones soportadas

Rulet se despliega de forma continua desde `main`: solo la última versión publicada recibe correcciones de
seguridad.

| Componente                   | Versión soportada                                     |
| ---------------------------- | ----------------------------------------------------- |
| API (`ghcr.io/…/rulet-api`)  | La imagen `latest` / último `sha-<commit>` de `main`  |
| Web (`ghcr.io/…/rulet-web`)  | La imagen `latest` / último `sha-<commit>` de `main`  |
| App móvil                    | La última versión publicada en tiendas y su canal OTA |
| Versiones anteriores y ramas | ❌ Sin soporte: actualiza a la última                 |

## Cómo informar de una vulnerabilidad

**No abras un issue público, un PR ni una discusión** con los detalles: expondría a los usuarios antes de que
exista una corrección.

Infórmala en privado mediante **GitHub Security Advisories**:

1. Ve a la pestaña [**Security → Advisories**](https://github.com/jorgemen2011-lgtm/rulet/security/advisories/new)
   del repositorio y pulsa **Report a vulnerability**.
2. Incluye, si puedes:
   - componente afectado (API, web, móvil, paquete) y versión o commit;
   - descripción del problema y su impacto (qué puede conseguir un atacante);
   - pasos para reproducirlo o una prueba de concepto mínima;
   - cualquier mitigación que conozcas.

Si no puedes usar GitHub, escribe al mantenedor indicado en [`CODEOWNERS`](.github/CODEOWNERS) a través de
su perfil de GitHub pidiendo un canal privado, sin incluir detalles técnicos en ese primer mensaje.

## Plazos de respuesta

| Paso                                          | Plazo objetivo                |
| --------------------------------------------- | ----------------------------- |
| Acuse de recibo                               | 3 días laborables             |
| Evaluación inicial (confirmación y severidad) | 7 días                        |
| Corrección de severidad crítica o alta        | 30 días desde la confirmación |
| Corrección de severidad media o baja          | 90 días desde la confirmación |

La severidad se calcula con CVSS v4. Te mantendremos informado del progreso y acordaremos contigo la fecha de
divulgación: publicaremos el advisory (con CVE cuando proceda) cuando la corrección esté desplegada y, si lo
deseas, te daremos crédito.

## Alcance

**Dentro del alcance**

- El código de este repositorio: API (`apps/api`), web (`apps/web`), app móvil (`apps/mobile`) y paquetes
  (`packages/*`).
- Autenticación y sesiones (JWT, refresh tokens, cookies), autorización, validación de entrada, CSRF/CORS.
- Configuración de CI/CD, Dockerfiles e imágenes publicadas.

**Fuera del alcance**

- Vulnerabilidades de dependencias de terceros sin un vector explotable en Rulet (infórmalas al proyecto
  original; nosotros las recibimos por Dependabot).
- Ataques de denegación de servicio volumétricos, ingeniería social o ataques físicos.
- Informes de escáneres automáticos sin prueba de impacto, cabeceras "recomendadas" sin impacto concreto,
  o problemas que requieren un dispositivo ya comprometido (root/jailbreak).
- Las credenciales de `docker-compose.yml` y `.devcontainer/`: son públicas a propósito y solo sirven para
  desarrollo local.

Pedimos que no accedas a datos de otros usuarios, no degrades el servicio y no hagas pruebas contra
producción más allá de lo mínimo para demostrar el problema. La investigación de buena fe que siga esta
política no tendrá acciones legales por nuestra parte.

## Medidas automatizadas

- **CodeQL** (`security-extended`) en cada PR, en `main` y semanalmente.
- **Dependency Review** bloquea PRs que introducen dependencias con vulnerabilidades altas o críticas.
- **gitleaks** busca secretos en los commits nuevos y, semanalmente, en todo el historial.
- **`pnpm audit --prod`** (severidad alta o mayor) y **Dependabot** para npm, GitHub Actions y Docker.
- **Trivy** escanea las imágenes Docker en CI (vulnerabilidades críticas/altas con parche disponible).
- Las imágenes se publican con SBOM, procedencia SLSA y atestación firmada (Sigstore).
- Las GitHub Actions están fijadas a SHA completo y los workflows usan permisos mínimos.

### Excepciones de `pnpm audit`

Las vulnerabilidades ignoradas se listan en `pnpm.auditConfig.ignoreGhsas` del `package.json` raíz. Solo se
admiten si no tienen versión corregida **y** no son explotables en Rulet; se revisan en cada actualización
de dependencias y se eliminan en cuanto exista una corrección.

| Advisory                                                                 | Paquete      | Motivo                                                                                                  |
| ------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------- |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `node-forge` | Solo en `@expo/cli` (herramienta de build local); no forma parte de la app ni del servidor. Sin parche. |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces`     | Solo en el bundler Metro (build); los patrones no los controla un usuario. Sin parche.                  |
