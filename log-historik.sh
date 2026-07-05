#!/bin/bash
# Søg i Energi Hub events-log via terminalen.
#
# Brug:
#   ./log-historik.sh                  → viser sidste 14 dage (standard)
#   ./log-historik.sh 3d                → viser sidste 3 dage
#   ./log-historik.sh 14d tesla         → sidste 14 dage, kun beskeder der indeholder "tesla"
#   ./log-historik.sh 7d "" bil_soc     → sidste 7 dage, kun type "bil_soc"

PERIODE="${1:--14d}"
SOEGETEKST="${2:-}"
TYPE_FILTER="${3:-}"

source /home/christopher/energi/.env 2>/dev/null

FLUX="from(bucket: \"energi2\")
  |> range(start: -${PERIODE})
  |> filter(fn: (r) => r._measurement == \"events\")"

if [ -n "$TYPE_FILTER" ]; then
  FLUX="$FLUX
  |> filter(fn: (r) => r.type == \"${TYPE_FILTER}\")"
fi

FLUX="$FLUX
  |> sort(columns: [\"_time\"], desc: true)"

RESULTAT=$(curl -s -X POST "http://192.168.1.253:8086/api/v2/query?org=energihub" \
  -H "Authorization: Token ${INFLUX_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -H "Accept: application/csv" \
  -d "$FLUX")

if [ -n "$SOEGETEKST" ]; then
  echo "$RESULTAT" | grep -i "$SOEGETEKST"
else
  echo "$RESULTAT"
fi
