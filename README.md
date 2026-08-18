# @eduardo3677-ai/apkdown-cli ⚡️

[![NPM Version](https://img.shields.io/npm/v/@eduardo3677-ai/apkdown-cli.svg?color=339933&style=flat-square)](https://www.npmjs.com/package/@eduardo3677-ai/apkdown-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Build & Test](https://img.shields.io/github/actions/workflow/status/eduardo3677-ai/apkdown-cli/publish.yml?branch=main&style=flat-square)](https://github.com/eduardo3677-ai/apkdown-cli/actions)

> **CLI profesional e Interfaz TUI interactiva para buscar, comparar versiones entre múltiples fuentes y descargar paquetes APK, XAPK, APKM y Split Bundles de Android con filtrado de arquitecturas de CPU y canales Beta / Preview / Insider.**

---

## 🌟 Características Principales

- 🔄 **Comparación Automática Multi-Proveedor:** Si no especificas un proveedor, busca en todas las fuentes disponibles en paralelo, compara las versiones semver y descarga automáticamente la **versión más reciente**.
- 🛡️ **8 Fuentes de APKs Integradas:** Conectores nativos para **Aptoide**, **APKMirror**, **APKPure**, **APKCombo**, **F-Droid**, **IzzyOnDroid**, **GitHub Releases** y **Huawei AppGallery**.
- 🖥️ **Modo CLI y TUI Interactivo:** Úsalo mediante comandos directos en terminal o con una interfaz visual basada en `@clack/prompts`.
- 🧬 **Filtrado por Arquitectura de CPU:** Soporte granular para `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` y `universal`.
- 🚀 **Canales de Lanzamiento & Previews:** Descarga versiones **Estables**, **Betas**, **Alphas**, **Canary**, **Previews** e **Insiders**.
- 🔒 **Evasión de Firewalls con TLS Fingerprint:** Capa híbrida con `curl_cffi` (impersonación de TLS Safari iOS y Chrome) para evitar bloqueos por Cloudflare.
- 📦 **Manejo de Paquetes Complejos:** Soporte para archivos `.apk`, `.xapk`, `.apkm` y `.apks`.
- 🔐 **Verificación de Integridad:** Comprobación automática de sumas de verificación criptográficas **SHA-256** y **MD5**.
- 📊 **Progreso en Tiempo Real:** Barra de progreso con velocidad (MB/s), ETA y tamaño transferido.
- 🧩 **Uso Programático:** Úsalo como librería en TypeScript / Node.js.

---

## 📦 Instalación

### Instalación Global (Recomendada)
```bash
npm install -g @eduardo3677-ai/apkdown-cli
```

### Uso Directo con `npx`
```bash
npx @eduardo3677-ai/apkdown-cli search telegram
```

### Como Dependencia en tu Proyecto
```bash
npm install @eduardo3677-ai/apkdown-cli
```

---

## 🚀 Uso Rápido

### 1. Interfaz Interactiva (TUI)
Inicia el asistente interactivo guiado por menús:
```bash
apkdown tui
# o también:
apkdown
```

### 2. Descarga Automática de la Última Versión
Si no especificas `-p`, la herramienta consulta todas las fuentes, muestra una tabla comparativa y descarga la versión más actualizada:
```bash
apkdown download org.telegram.messenger
```

### 3. Búsqueda de Aplicaciones
```bash
# Buscar en todos los proveedores
apkdown search spotify

# Buscar en un proveedor específico
apkdown search spotify -p apkmirror -l 5

# Incluir versiones Beta
apkdown search telegram -b
```

### 4. Descarga con Opciones Avanzadas
```bash
# Descargar versión Beta en arquitectura ARM64 desde APKMirror
apkdown download telegram -p apkmirror --channel beta -a arm64-v8a -o ./mis-apks

# Descargar desde F-Droid con verificación SHA-256
apkdown download org.fdroid.fdroid -p fdroid -o ./downloads

# Descargar desde GitHub Releases (open source)
apkdown download revanced -p github -o ./mis-apks
```

### 5. Consultar Detalles y Variantes
```bash
apkdown info org.videolan.vlc
apkdown versions com.whatsapp -p apkpure
```

---

## 🌐 Proveedores Soportados

| Proveedor | Identificador | Formatos | Multi-Arch | Canales Beta | Verificación Hash |
|---|:---:|:---:|:---:|:---:|:---:|
| **Aptoide** | `aptoide` | APK | ✅ | ✅ | MD5 / SHA-1 |
| **APKMirror** | `apkmirror` | APK, APKM | ✅ | ✅ (Beta, Alpha, Canary) | R2 Storage |
| **APKPure** | `apkpure` | APK, XAPK | ✅ | ✅ | Winudf CDN |
| **APKCombo** | `apkcombo` | APK, XAPK | ✅ | ✅ | Cloudflare R2 |
| **F-Droid** | `fdroid` | APK | ✅ | ✅ | SHA-256 Oficial |
| **IzzyOnDroid** | `izzyondroid`| APK | ✅ | ✅ | SHA-256 Repo |
| **GitHub Releases** | `github` | APK, XAPK | ✅ | ✅ (Pre-releases) | GitHub Asset |
| **Huawei AppGallery** | `appgallery` | APK | ✅ | ✅ | HMS Ecosystem |

---

## 🛠️ Comandos de la CLI

```
Uso: apkdown [comando] [opciones]

Comandos:
  search <query>          Busca aplicaciones en los proveedores
  download <app>          Descarga un APK o bundle
  info <app>              Muestra metadatos y lista de variantes
  versions <app>          Lista versiones históricas y actuales
  providers               Muestra la lista de proveedores y su estado
  config                  Ver o modificar configuración persistente
  tui                     Inicia la interfaz de terminal interactiva

Opciones de Descarga:
  -p, --provider <name>   Proveedor a utilizar (por defecto: all)
  -v, --version <string>  Versión específica o "latest"
  -a, --arch <arch>       Arquitectura: arm64-v8a, armeabi-v7a, x86_64, universal
  -c, --channel <chan>    Canal: stable, beta, alpha, insider, preview, all
  -b, --beta              Habilitar versiones beta
  -o, --output <dir>      Directorio de salida
  -f, --force             Sobrescribir archivos existentes
  --no-verify             Omitir verificación criptográfica
```

---

## 💻 Uso Programático (API TypeScript / Node.js)

```typescript
import {
  searchApks,
  downloadApk,
  getAppDetails,
  compareVersions
} from '@eduardo3677-ai/apkdown-cli';

// 1. Buscar en todos los proveedores
const results = await searchApks({
  query: 'telegram',
  limit: 5,
  includeBeta: true,
});

// 2. Obtener detalles y variantes
const details = await getAppDetails('apkmirror', 'telegram');
console.log('Variantes encontradas:', details.variants.length);

// 3. Descargar comparando automáticamente la última versión
const downloadResult = await downloadApk('all', 'org.telegram.messenger', {
  preferredArch: 'arm64-v8a',
  allowBeta: true,
  outputDir: './downloads',
  onProgress: (p) => {
    console.log(`Progreso: ${p.percentage}% | Velocidad: ${p.speedBytesPerSec} B/s`);
  },
});

console.log('Descargado en:', downloadResult.filePath);
console.log('SHA-256:', downloadResult.sha256);
```

---

## 🏗️ Estructura del Proyecto

```
apkdown-cli/
├── src/
│   ├── bin/cli.ts             # Punto de entrada ejecutable CLI
│   ├── cli/
│   │   ├── commands/          # Comandos Commander (search, download, info, etc.)
│   │   └── ui/                # UI helpers (tablas, barras de progreso, logger)
│   ├── core/
│   │   ├── config.ts          # Gestor de configuración persistente
│   │   ├── downloader.ts      # Motor de selección, streaming y verificación de APKs
│   │   ├── errors.ts          # Jerarquía de errores tipados
│   │   └── types.ts           # Modelos de dominio e interfaces TypeScript
│   ├── http/
│   │   ├── client.ts          # Interfaz HttpClient
│   │   ├── curl-client.ts     # Puente Python curl_cffi con TLS impersonation
│   │   ├── fetch-client.ts    # Cliente fetch nativo con streaming
│   │   └── hybrid-client.ts   # Router inteligente de peticiones
│   ├── providers/             # Implementación modular de los 8 proveedores
│   ├── tui/                   # Pantallas interactivas TUI (@clack/prompts)
│   ├── utils/                 # Utilidades (arch, hash, formatting, semver)
│   └── index.ts               # Exportaciones de librería pública
├── scripts/
│   └── curl_bridge.py         # Subproceso bridge de curl_cffi
├── tests/                     # Suite de pruebas unitarias Vitest
└── .github/workflows/         # CI/CD y publicación automatizada en NPM
```

---

## 🧪 Pruebas Unitarias

```bash
# Ejecutar tests con Vitest
npm test

# Verificación de tipos TypeScript
npm run typecheck

# Compilación con tsup
npm run build
```

---

## 👤 Autor

- **Eduardo** ([@eduardo3677-ai](https://github.com/eduardo3677-ai))

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
