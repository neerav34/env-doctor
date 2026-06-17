const express = require('express');

const REDIS_URL = process.env.REDIS_URL;
const API_TOKEN = process.env.API_TOKEN;
const NODE_ENV = process.env.NODE_ENV;

module.exports = { REDIS_URL, API_TOKEN, NODE_ENV };
