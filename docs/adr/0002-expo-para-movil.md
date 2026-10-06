# 0002. Expo (React Native) para la app móvil

- **Estado**: Aceptada
- **Fecha**: 2026-10-06

## Contexto

La app móvil es el producto principal y debe salir en iOS y Android con un solo equipo y TypeScript.

## Decisión

**React Native con Expo** (SDK gestionado, `expo-router`, builds y envío a tiendas con **EAS**). Tres variantes (`development`, `preview`, `production`) con bundle id propio, definidas en `app.config.ts` y `eas.json`.

## Alternativas consideradas

- **React Native sin Expo** — más mantenimiento nativo sin beneficio claro; Expo permite añadir código nativo con _config plugins_ o _dev builds_ si hace falta.
- **Flutter / nativo** — rompe el lenguaje común con web y API.

## Consecuencias

- Actualizaciones OTA de JS con `eas update` sin pasar por tienda.
- Los módulos nativos se añaden vía config plugins; los directorios `ios/` y `android/` se generan y no se versionan.
