{{/*
=============================================================================
HeadySystems Inc. — Helm Template Helpers
heady-platform v3.2.2
=============================================================================
φ = 1.618033988749895 (Golden Ratio)
Standard Helm helper functions for heady-platform
=============================================================================
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "heady-platform.name" -}}
{{- default .Chart.Name .Values.global.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this.
*/}}
{{- define "heady-platform.fullname" -}}
{{- if .Values.global.fullnameOverride }}
{{- .Values.global.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.global.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "heady-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to all resources.
Includes φ annotation for traceability.
*/}}
{{- define "heady-platform.labels" -}}
helm.sh/chart: {{ include "heady-platform.chart" . }}
{{ include "heady-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
headysystems.com/phi: "1.618033988749895"
headysystems.com/version: {{ .Chart.AppVersion | quote }}
headysystems.com/environment: {{ .Values.global.environment | quote }}
{{- with .Values.global.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels — used for Service and Deployment selectors.
Must be immutable — never change once deployed.
*/}}
{{- define "heady-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "heady-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service-specific full name helper.
Usage: {{ include "heady-platform.serviceName" (dict "service" "heady-brain" "context" .) }}
*/}}
{{- define "heady-platform.serviceName" -}}
{{- printf "%s-%s" .context.Release.Name .service | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Service selector labels.
Usage: {{ include "heady-platform.serviceSelectorLabels" (dict "service" "heady-brain" "component" "brain" "context" .) }}
*/}}
{{- define "heady-platform.serviceSelectorLabels" -}}
app.kubernetes.io/name: {{ .service }}
app.kubernetes.io/instance: {{ printf "%s-production" .service }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Standard service labels.
*/}}
{{- define "heady-platform.serviceLabels" -}}
{{ include "heady-platform.labels" .context }}
app.kubernetes.io/name: {{ .service }}
app.kubernetes.io/component: {{ .component }}
headysystems.com/tier: {{ .tier }}
{{- end }}

{{/*
Pod template labels.
*/}}
{{- define "heady-platform.podLabels" -}}
app.kubernetes.io/name: {{ .service }}
app.kubernetes.io/instance: {{ printf "%s-production" .service }}
app.kubernetes.io/version: {{ .context.Chart.AppVersion | quote }}
app.kubernetes.io/component: {{ .component }}
headysystems.com/tier: {{ .tier }}
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "heady-platform.serviceAccountName" -}}
{{- if .Values.serviceAccounts.create }}
{{- .name | default (include "heady-platform.fullname" .) }}
{{- else }}
{{- default "default" .Values.serviceAccounts.name }}
{{- end }}
{{- end }}

{{/*
Image pull secrets.
*/}}
{{- define "heady-platform.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Global pod security context.
*/}}
{{- define "heady-platform.podSecurityContext" -}}
{{- toYaml .Values.global.podSecurityContext | nindent 0 }}
{{- end }}

{{/*
Global container security context.
*/}}
{{- define "heady-platform.containerSecurityContext" -}}
{{- toYaml .Values.global.containerSecurityContext | nindent 0 }}
{{- end }}

{{/*
φ constant annotation helper.
*/}}
{{- define "heady-platform.phiAnnotations" -}}
headysystems.com/phi: "1.618033988749895"
headysystems.com/fibonacci: "1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597"
{{- end }}

{{/*
Standard probe configuration from values.
Usage: {{ include "heady-platform.livenessProbe" .probe }}
*/}}
{{- define "heady-platform.livenessProbe" -}}
livenessProbe:
  httpGet:
    path: {{ .httpGet.path }}
    port: {{ .httpGet.port }}
  initialDelaySeconds: {{ .initialDelaySeconds }}
  periodSeconds: {{ .periodSeconds }}
  timeoutSeconds: {{ .timeoutSeconds }}
  failureThreshold: {{ .failureThreshold }}
  successThreshold: {{ .successThreshold }}
{{- end }}

{{/*
Image reference helper.
Usage: {{ include "heady-platform.image" (dict "repo" .Values.headyBrain.image.repository "tag" .Values.headyBrain.image.tag "global" .Values.global) }}
*/}}
{{- define "heady-platform.image" -}}
{{- $registry := .global.imageRegistry }}
{{- $tag := .tag | default .global.imageTag }}
{{- printf "%s:%s" .repo $tag }}
{{- end }}

{{/*
Environment variable list from ConfigMap + Secret.
*/}}
{{- define "heady-platform.envFrom" -}}
envFrom:
  - configMapRef:
      name: heady-config
  - secretRef:
      name: heady-secrets
{{- end }}

{{/*
Standard topology spread constraints.
*/}}
{{- define "heady-platform.topologySpread" -}}
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: {{ .service }}
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: {{ .service }}
{{- end }}

{{/*
Standard pod anti-affinity.
*/}}
{{- define "heady-platform.podAntiAffinity" -}}
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
            - key: app.kubernetes.io/name
              operator: In
              values:
                - {{ .service }}
        topologyKey: kubernetes.io/hostname
    preferredDuringSchedulingIgnoredDuringExecution:
      # weight: fib(11)=89
      - weight: 89
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - {{ .service }}
          topologyKey: topology.kubernetes.io/zone
{{- end }}

{{/*
φ-derived resource limits.
Standard sizes:
  small:  cpu=500m/200m  memory=512Mi/256Mi
  medium: cpu=1000m/200m memory=1Gi/256Mi
  large:  cpu=2000m/500m memory=2Gi/512Mi
*/}}
{{- define "heady-platform.resources" -}}
resources:
  requests:
    cpu: {{ .requests.cpu | quote }}
    memory: {{ .requests.memory | quote }}
  limits:
    cpu: {{ .limits.cpu | quote }}
    memory: {{ .limits.memory | quote }}
{{- end }}
