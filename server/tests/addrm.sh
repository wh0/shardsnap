#!/bin/sh -eux
endpoint=$1
. ./test-vars.sh
curl -vfX PUT -H 'Content-Type: application/json' -d @- "$endpoint/relays/$alias" <<EOF
{
	"token": "",
	"intents": "4608",
	"criteria": {},
	"dst": "ws://none.invalid/",
	"clientSecret": "$secret"
}
EOF
curl -vfX DELETE -u "$secret" "$endpoint/relays/$alias"
