FROM python:3.10

COPY ./app /app
WORKDIR /app
RUN set -ex && \
    pip install -r requirements.txt
EXPOSE 8050
CMD ["gunicorn", "-b", "0.0.0.0:8050", "--reload", "app:server"]
