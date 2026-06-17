import os

# Standard patterns
secret_key = os.environ['SECRET_KEY']
debug = os.environ.get('DEBUG', 'false')
port = os.getenv('PORT', '5000')
db_url = os.environ.get('DATABASE_URL')

# This should NOT be detected (commented)
# old = os.getenv('OLD_SECRET')
