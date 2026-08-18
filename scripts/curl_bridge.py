#!/usr/bin/env python3
"""
curl_bridge.py
High-performance TLS-impersonation HTTP bridge for apkdown-cli.
Allows Node.js to perform realistic browser-fingerprinted TLS/HTTP2 requests
to bypass Cloudflare and Bot detection mechanisms on APK platforms.
"""

import sys
import json
import os
from typing import Dict, Any, Optional

try:
    from curl_cffi import requests
    HAS_CURL_CFFI = True
except ImportError:
    HAS_CURL_CFFI = False
    import urllib.request
    import urllib.error


def execute_request(req_data: Dict[str, Any]) -> Dict[str, Any]:
    url = req_data.get("url")
    if not url:
        return {"error": "Missing URL parameter", "status": 400}

    method = req_data.get("method", "GET").upper()
    headers = req_data.get("headers", {})
    params = req_data.get("params")
    impersonate = req_data.get("impersonate", "safari_ios")
    timeout = req_data.get("timeout", 20)
    stream_to_file = req_data.get("stream_to_file")
    allow_redirects = req_data.get("allow_redirects", True)
    data = req_data.get("data")
    json_payload = req_data.get("json")

    # Set default realistic browser headers if missing
    if "User-Agent" not in headers and "user-agent" not in headers:
        headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
    if "Accept" not in headers and "accept" not in headers:
        headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    if "Accept-Language" not in headers and "accept-language" not in headers:
        headers["Accept-Language"] = "en-US,en;q=0.9,es;q=0.8"

    if HAS_CURL_CFFI:
        try:
            session = requests.Session(impersonate=impersonate)
            
            if stream_to_file:
                # Direct streaming to destination file with progress
                resp = session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    data=data,
                    json=json_payload,
                    timeout=timeout,
                    stream=True,
                    allow_redirects=allow_redirects
                )
                
                if resp.status_code >= 400:
                    return {
                        "status": resp.status_code,
                        "headers": dict(resp.headers),
                        "finalUrl": resp.url,
                        "error": f"HTTP {resp.status_code}"
                    }

                total_size = int(resp.headers.get("content-length", 0))
                downloaded = 0
                
                os.makedirs(os.path.dirname(os.path.abspath(stream_to_file)), exist_ok=True)
                with open(stream_to_file, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                
                return {
                    "status": resp.status_code,
                    "headers": dict(resp.headers),
                    "finalUrl": resp.url,
                    "bytesWritten": downloaded,
                    "totalBytes": total_size,
                    "filePath": stream_to_file
                }
            else:
                resp = session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    data=data,
                    json=json_payload,
                    timeout=timeout,
                    allow_redirects=allow_redirects
                )
                
                return {
                    "status": resp.status_code,
                    "headers": dict(resp.headers),
                    "finalUrl": resp.url,
                    "body": resp.text
                }
        except Exception as ex:
            return {"error": str(ex), "status": 500}
    else:
        # Fallback using standard urllib if curl_cffi is unavailable
        try:
            req = urllib.request.Request(url, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = resp.status
                headers_dict = dict(resp.headers)
                final_url = resp.geturl()
                
                if stream_to_file:
                    os.makedirs(os.path.dirname(os.path.abspath(stream_to_file)), exist_ok=True)
                    downloaded = 0
                    with open(stream_to_file, "wb") as f:
                        while True:
                            chunk = resp.read(65536)
                            if not chunk:
                                break
                            f.write(chunk)
                            downloaded += len(chunk)
                    return {
                        "status": status,
                        "headers": headers_dict,
                        "finalUrl": final_url,
                        "bytesWritten": downloaded,
                        "filePath": stream_to_file
                    }
                else:
                    body = resp.read().decode("utf-8", errors="replace")
                    return {
                        "status": status,
                        "headers": headers_dict,
                        "finalUrl": final_url,
                        "body": body
                    }
        except urllib.error.HTTPError as he:
            return {"error": str(he), "status": he.code, "body": he.read().decode("utf-8", errors="replace")}
        except Exception as ex:
            return {"error": str(ex), "status": 500}


def main():
    if len(sys.argv) > 1:
        # Request provided as json argument
        arg = sys.argv[1]
        try:
            req_data = json.loads(arg)
            res = execute_request(req_data)
            print(json.dumps(res))
        except Exception as e:
            print(json.dumps({"error": f"Failed to parse JSON argument: {e}", "status": 400}))
    else:
        # Read from stdin
        try:
            input_text = sys.stdin.read()
            if not input_text.strip():
                print(json.dumps({"error": "Empty input", "status": 400}))
                return
            req_data = json.loads(input_text)
            res = execute_request(req_data)
            print(json.dumps(res))
        except Exception as e:
            print(json.dumps({"error": f"Failed to process stdin: {e}", "status": 400}))


if __name__ == "__main__":
    main()
