# Use an official Node.js runtime as the base image
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the project code to the container
COPY . .

# Build the React app
RUN npm run build

# Set environment variable for serving the React app
ENV NODE_ENV=production

# Expose the port on which the React app will run (change as needed)
EXPOSE 3000

# Serve the React app using a static file server
CMD ["npx", "serve", "-s", "build"]

