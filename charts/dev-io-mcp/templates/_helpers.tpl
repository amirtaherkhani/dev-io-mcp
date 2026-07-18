{{/* Expand the chart name. */}}
{{- define "dev-io-mcp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Create a fully qualified app name. */}}
{{- define "dev-io-mcp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/* Chart label. */}}
{{- define "dev-io-mcp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Common labels. */}}
{{- define "dev-io-mcp.labels" -}}
helm.sh/chart: {{ include "dev-io-mcp.chart" . }}
{{ include "dev-io-mcp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* Selector labels. */}}
{{- define "dev-io-mcp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dev-io-mcp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* Service account name. */}}
{{- define "dev-io-mcp.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "dev-io-mcp.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* Image reference with optional digest pinning. */}}
{{- define "dev-io-mcp.image" -}}
{{- if .Values.image.digest -}}
{{ printf "%s@%s" .Values.image.repository .Values.image.digest }}
{{- else -}}
{{ printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}
{{- end }}

{{/* Names for storage resources. */}}
{{- define "dev-io-mcp.postsPvc" -}}
{{- printf "%s-posts" (include "dev-io-mcp.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "dev-io-mcp.dataPvc" -}}
{{- printf "%s-data" (include "dev-io-mcp.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
