# Componentes (web)

UI reutilizable **sin lógica de negocio**: no llaman a la API ni importan de `features/`. Reciben datos y
callbacks por props.

```
components/
  Button.tsx (+ Button.module.css)
  TextField.tsx      label + input + error, accesible (aria-invalid, aria-describedby)
  Alert.tsx          mensajes de error (role="alert") o informativos (role="status")
  Card.tsx           tarjeta con título (h1) para pantallas sencillas
  SiteHeader.tsx     cabecera; la navegación llega como `children`
```

Reglas:

- Estilos con CSS Modules (`Nombre.module.css`) y las variables de `styles/globals.css`.
- **Nunca `style={{…}}`**: la Content-Security-Policy de producción bloquea los atributos `style` en línea.
- Accesibilidad por defecto: cada input tiene `<label>`, los errores se asocian con `aria-describedby`.
