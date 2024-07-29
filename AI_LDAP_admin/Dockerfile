# Use an official Python runtime as the base image
FROM python:3.11

# Set environment variables
ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1

# Set the working directory in the container
WORKDIR /code

# Copy the requirements file to the container
COPY requirements.txt /code/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

RUN pip install kubernetes

RUN apt-get update
RUN apt-get install vim -y
RUN apt-get install inetutils-ping

# Copy the project code to the container
COPY . /code/
RUN mkdir /static
COPY static /static
# RUN rm -rf /code/static
# COPY static /

# Expose the port on which the Django app will run (change as needed)
EXPOSE 8000

## check makemigrations and migrate and then runserver
CMD ["sh", "-c", "python manage.py makemigrations && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]

