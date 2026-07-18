#!/bin/sh
# Render free chỉ cho 1 service, nên chạy server + bot chung 1 container.
# bot chạy nền, server chạy foreground (giữ container sống).

node admin-bot.js &
BOT_PID=$!

node server.js &
SERVER_PID=$!

trap "kill $BOT_PID $SERVER_PID" TERM INT

wait $SERVER_PID
