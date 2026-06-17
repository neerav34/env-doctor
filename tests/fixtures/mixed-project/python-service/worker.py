import os

REDIS_URL = os.environ.get('REDIS_URL')
QUEUE_NAME = os.getenv('QUEUE_NAME', 'default')
MISSING_VAR = os.environ['MISSING_REQUIRED_VAR']
