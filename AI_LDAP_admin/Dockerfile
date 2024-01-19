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

# Copy the project code to the container
COPY . /code/
RUN mkdir /static
COPY static /static
# RUN rm -rf /code/static
# COPY static /

# FROM bitnami/kubectl:1.20.9 as kubectl
# COPY --from=kubectl /opt/bitnami/kubectl/bin/kubectl /usr/local/bin/

# Expose the port on which the Django app will run (change as needed)
EXPOSE 8000

# migrate the database and run the server

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

