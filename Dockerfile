# Use an official Python runtime as the base image
FROM python:3.11 as backend

# Set environment variables
ENV PYTHONUNBUFFERED 1
ENV PYTHONDONTWRITEBYTECODE 1

# Set the working directory in the container
WORKDIR /backend

# Copy the requirements file to the container
COPY AI_LDAP_admin/requirements.txt /backend/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the project code to the container
COPY AI_LDAP_admin/. /backend/

# Expose the port on which the Django app will run (change as needed)
EXPOSE 8000

# Use an official Node.js runtime as the base image
FROM node:14-alpine as frontend

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
COPY frontend/package*.json /app/

# Install dependencies
RUN npm install

# Copy the project code to the container
COPY frontend/. /app/

# Build the React app
RUN npm run build

# Set environment variable for serving the React app
ENV NODE_ENV=production

# Expose the port on which the React app will run (change as needed)
EXPOSE 3000

# Run the Django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

