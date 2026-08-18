# @eduardo3677-ai/apkdown-cli ⚡️

[![NPM Version](https://img.shields.io/npm/v/@eduardo3677-ai/apkdown-cli.svg?color=339933&style=flat-square)](https://www.npmjs.com/package/@eduardo3677-ai/apkdown-cli)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-APKDown%20Action-blue.svg?colorA=24292e&colorB=0366d6&style=flat-square)](https://github.com/marketplace/actions/apkdown-multi-source-android-apk-downloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Build & Test](https://img.shields.io/github/actions/workflow/status/eduardo3677-ai/apkdown-cli/publish.yml?branch=main&style=flat-square)](https://github.com/eduardo3677-ai/apkdown-cli/actions)

> **CLI profesional, Interfaz TUI interactiva y GitHub Action para Marketplace diseñada para buscar, comparar versiones entre múltiples fuentes y descargar paquetes APK, XAPK, APKM y Split Bundles de Android con filtrado de arquitecturas de CPU y canales Beta / Preview / Insider.**

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

Puedes utilizar la action en cualquier repositorio de GitHub simplemente agregando el paso `uses: eduardo3677-ai/apkdown-cli@v1`:

```yaml
name: Download and Release Android APK

on:
  push:
    branches: [main]
  workflow_dispatch:

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
          channel: 'stable'
          output-dir: './artifacts'

      - name: Print Download Outputs
        run: |
          echo "Archivo:   ${{ steps.apkdown.outputs.file-path }}"
          echo "Versión:   ${{ steps.apkdown.outputs.version }}"
          echo "Formato:   ${{ steps.apkdown.outputs.package-type }}"
          echo "Tamaño:    ${{ steps.apkdown.outputs.file-size-formatted }}"
          echo "SHA-256:   ${{ steps.apkdown.outputs.sha256 }}"
          echo "Proveedor: ${{ steps.apkdown.outputs.provider }}"

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: telegram-apk
          path: ${{ steps.apkdown.outputs.file-path }}
```

---

### 📋 Tabla Completa de Parámetros de la GitHub Action (`with`):

| Parámetro | Tipo | Requerido | Por Defecto | Valores Permitidos / Descripción |
|:---|:---:|:---:|:---:|:---|
| `id` | `string` | **Sí** | - | Nombre de la app, package ID (ej. `org.telegram.messenger`, `com.whatsapp`) o repositorio GitHub (`ReVanced/revanced-manager`). |
| `provider` | `string` | No | `all` | Proveedor o lista de proveedores permitidos separados por coma: `aptoide`, `apkmirror`, `apkpure`, `apkcombo`, `fdroid`, `izzyondroid`, `github`, `appgallery`, `all`. |
| `exclude-provider` | `string` | No | `""` | Proveedores a deshabilitar/excluir separados por coma (ej. `appgallery,aptoide`). |
| `arch` | `string` | No | `auto` | Arquitectura de CPU objetivo: `auto`, `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`, `universal`, `all`. |
| `version` | `string` | No | `latest` | Versión específica a descargar (ej. `12.9.2`) o `"latest"` para la última disponible. |
| `channel` | `string` | No | `stable` | Canal de lanzamiento: `stable`, `beta`, `alpha`, `insider`, `preview`, `all`. |
| `allow-beta` | `boolean` | No | `false` | Habilita la descarga de versiones Beta / Preview / Prerelease. |
| `output-dir` | `string` | No | `./downloads` | Directorio donde se guardará el archivo descargado. |
| `filename` | `string` | No | `""` | Nombre personalizado para el archivo guardado (opcional). |
| `verify-checksum` | `boolean` | No | `true` | Valida automáticamente los hashes criptográficos (SHA-256 / MD5). |

---

### 📤 Salidas Generadas por la GitHub Action (`outputs`):

| Salida | Tipo | Descripción | Ejemplo |
|:---|:---:|:---|:---|
| `file-path` | `string` | Ruta absoluta al binario descargado | `/home/runner/work/app/artifacts/Telegram_v12.10.0_universal_apkmirror.apk` |
| `file-name` | `string` | Nombre del archivo generado | `Telegram_v12.10.0_universal_apkmirror.apk` |
| `file-size` | `number` | Tamaño exacto en bytes | `84284065` |
| `file-size-formatted` | `string` | Tamaño legible para humanos | `80.38 MB` |
| `version` | `string` | Versión resuelta del paquete | `12.10.0` |
| `package-type` | `string` | Formato del paquete descargado | `APK`, `XAPK`, `APKM` |
| `sha256` | `string` | Hash SHA-256 del archivo | `f8b40c25166fa5b4ba2249f092ca08c...` |
| `provider` | `string` | Proveedor del cual se descargó | `apkmirror` |

---

## 📦 Instalación y Uso de la CLI

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

# 3. Descargar excluyendo proveedores específicos y seleccionando arquitectura
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

## 🔄 Sistema de Versionado y Publicación Sincronizada

El flujo de trabajo en `.github/workflows/publish.yml` gestiona automáticamente la sincronización:
1. **Detección y Auto-Bump:** Comprueba si la versión ya existe en NPM; si es necesario, incrementa automáticamente la versión (`patch` / `minor` / `major`).
2. **Commit y Push Automático:** Hace commit de `package.json` y `package-lock.json` al repositorio en `main`.
3. **Pull y Compilación Sincronizada:** Ejecuta `git pull --rebase` y compila los bundles con `npm run build`.
4. **Publicación Sincronizada:** Publica el paquete en el registro de NPM (`@eduardo3677-ai/apkdown-cli`) y crea el Release correspondiente en GitHub con el tag de versión exacta (ej. `v1.0.1`) y el tag flotante mayor `v1`.

---

## 👤 Autor

- **Eduardo** ([@eduardo3677-ai](https://github.com/eduardo3677-ai))

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
