#!/bin/bash

pnpm i

pnpm build

mkdir -p out

cp -r dist/ index.html out/
