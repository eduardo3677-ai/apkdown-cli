# @eduardo3677-ai/apkdown-cli ⚡️

[![NPM Version](https://img.shields.io/npm/v/@eduardo3677-ai/apkdown-cli.svg?color=339933&style=flat-square)](https://www.npmjs.com/package/@eduardo3677-ai/apkdown-cli)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-APKDown%20Action-blue.svg?colorA=24292e&colorB=0366d6&style=flat-square)](https://github.com/marketplace/actions/apkdown-multi-source-android-apk-downloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Build & Test](https://img.shields.io/github/actions/workflow/status/eduardo3677-ai/apkdown-cli/publish.yml?branch=main&style=flat-square)](https://github.com/eduardo3677-ai/apkdown-cli/actions)

> **CLI profesional, Interfaz TUI y GitHub Action para buscar, comparar versiones entre múltiples fuentes y descargar paquetes APK, XAPK, APKM y Split Bundles de Android con filtrado de arquitecturas de CPU y canales Beta / Preview / Insider.**

---

## 🌟 Características Principales

- 🔄 **Comparación Automática Multi-Proveedor:** Si no especificas un proveedor, consulta todas las fuentes disponibles en paralelo, compara las versiones semver y descarga automáticamente la **versión más reciente**.
- 🤖 **GitHub Action Oficial para Marketplace:** Descarga cualquier APK directamente en tus flujos de trabajo de CI/CD (`uses: eduardo3677-ai/apkdown-cli@v1`).
- 🛡️ **8 Fuentes de APKs Integradas:** Conectores nativos para **Aptoide**, **APKMirror**, **APKPure**, **APKCombo**, **F-Droid**, **IzzyOnDroid**, **GitHub Releases** y **Huawei AppGallery**.
- 🚫 **Deshabilitación/Exclusión de Proveedores:** Opción `-x, --exclude` para excluir proveedores específicos (ej. `-x appgallery,aptoide`).
- 🖥️ **Modo CLI y TUI Interactivo:** Úsalo mediante comandos directos en terminal o con una interfaz visual guiada por menús.
- 🧬 **Filtrado por Arquitectura de CPU:** Soporte para `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` y `universal`.
- 🚀 **Canales de Lanzamiento & Previews:** Descarga versiones **Estables**, **Betas**, **Alphas**, **Canary**, **Previews** e **Insiders**.
- 🔒 **Evasión de Firewalls con TLS Fingerprint:** Capa híbrida con `curl_cffi` (impersonación de TLS Safari iOS y Chrome) para evitar bloqueos por Cloudflare.
- 🔐 **Verificación Criptográfica:** Comprobación automática de sumas de verificación **SHA-256** y **MD5**.
- 📊 **Progreso en Tiempo Real:** Barra de progreso con velocidad (MB/s), ETA y tamaño transferido.

---

## 🤖 Uso en GitHub Actions (Marketplace)

Puedes usar esta herramienta como un paso nativo en tus flujos de trabajo de GitHub Actions:

```yaml
name: Download Android APK

on: [push, workflow_dispatch]

jobs:
  download-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Download Latest Telegram APK
        id: apkdown
        uses: eduardo3677-ai/apkdown-cli@v1
        with:
          id: 'org.telegram.messenger'
          provider: 'all'
          exclude-provider: 'appgallery'
          arch: 'arm64-v8a'
          output-dir: './artifacts'

      - name: Print Download Info
        run: |
          echo "Archivo descargado: ${{ steps.apkdown.outputs.file-path }}"
          echo "Versión: ${{ steps.apkdown.outputs.version }}"
          echo "SHA256: ${{ steps.apkdown.outputs.sha256 }}"

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: telegram-apk
          path: ${{ steps.apkdown.outputs.file-path }}
```

### Opciones del GitHub Action (`with`):

| Entrada | Descripción | Por Defecto |
|:---|:---|:---:|
| `id` | Nombre de app, package identifier (ej. `com.whatsapp`, `org.telegram.messenger`) o repo | **Requerido** |
| `provider` | Proveedores autorizados separados por coma (`all`, `apkmirror`, `apkpure`, etc.) | `all` |
| `exclude-provider` | Proveedores a excluir separados por coma (ej. `appgallery,aptoide`) | `""` |
| `arch` | Arquitectura de CPU objetivo (`auto`, `arm64-v8a`, `armeabi-v7a`, `universal`) | `auto` |
| `version` | Versión específica a descargar o `"latest"` | `latest` |
| `channel` | Canal de lanzamiento: `stable`, `beta`, `alpha`, `insider`, `preview`, `all` | `stable` |
| `allow-beta` | Permitir versiones beta o previas (`true` / `false`) | `false` |
| `output-dir` | Directorio de destino para guardar el APK | `./downloads` |
| `filename` | Nombre de archivo personalizado | `""` |
| `verify-checksum` | Verificar hash SHA256/MD5 si está disponible | `true` |

### Salidas del GitHub Action (`outputs`):
- `file-path`: Ruta absoluta del archivo descargado.
- `file-name`: Nombre del archivo descargado.
- `file-size`: Tamaño en bytes.
- `file-size-formatted`: Tamaño legible (ej. `80.4 MB`).
- `version`: Versión resuelta del paquete.
- `package-type`: Formato (`APK`, `XAPK`, `APKM`).
- `sha256`: Hash SHA-256 del binario.
- `provider`: Proveedor de donde se descargó.

---

## 📦 Instalación del CLI

### Instalación Global
```bash
npm install -g @eduardo3677-ai/apkdown-cli
```

### Uso Directo con `npx`
```bash
npx @eduardo3677-ai/apkdown-cli search telegram
```

---

## 🚀 Ejemplos de Comandos CLI

```bash
# 1. Iniciar interfaz interactiva TUI
apkdown tui

# 2. Descarga automática de la última versión comparando todos los proveedores
apkdown download org.telegram.messenger -o ./mis-apks

# 3. Descargar excluyendo proveedores específicos
apkdown download telegram -x appgallery,aptoide -a arm64-v8a -o ./mis-apks

# 4. Buscar aplicaciones con filtro de arquitectura y canal Beta
apkdown search telegram -p apkmirror,apkpure -a arm64-v8a -b -l 5

# 5. Ver detalles, metadatos y variantes de CPU
apkdown info org.videolan.vlc -p fdroid -a arm64-v8a
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

## 💻 Uso Programático (API TypeScript / Node.js)

```typescript
import {
  searchApks,
  downloadApk,
  getAppDetails,
  compareVersions
} from '@eduardo3677-ai/apkdown-cli';

// Buscar y comparar versiones en todos los proveedores
const results = await searchApks({
  query: 'telegram',
  excludeProviders: ['appgallery'],
  arch: 'arm64-v8a',
  limit: 5,
});

// Descargar comparando automáticamente la última versión
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

## 👤 Autor

- **Eduardo** ([@eduardo3677-ai](https://github.com/eduardo3677-ai))

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
