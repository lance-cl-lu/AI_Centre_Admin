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

# Copy the project code to the container
COPY . /code/

# Expose the port on which the Django app will run (change as needed)
EXPOSE 8000

# migrate the database and run the server

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

