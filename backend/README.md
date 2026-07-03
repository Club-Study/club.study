# Django Backend

This backend is the migration target for replacing direct Supabase client access.

## Setup

1. Create a virtual environment.
2. Install `requirements.txt`.
3. Export every variable from `.env.example` with real values.
4. Run `python manage.py migrate`.
5. Run `python manage.py runserver`.

The settings intentionally fail if required environment variables are missing.
