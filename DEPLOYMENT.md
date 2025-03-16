# Suimon Game AWS Deployment Guide

## Prerequisites
1. AWS Account with appropriate permissions
2. AWS CLI installed and configured
3. Terraform installed locally
4. Node.js and npm installed
5. SSH key pair for EC2 access

## SSH Key Setup
1. Generate SSH key pair for EC2 access:
```bash
ssh-keygen -t rsa -b 2048 -f suimon-backend-key
```
2. Move the public key to the Terraform directory:
```bash
mv suimon-backend-key.pub ./suimon-game/
```
3. Keep the private key (suimon-backend-key) secure and never commit it to version control

## Deployment Steps

### 1. Infrastructure Setup
```bash
# Initialize Terraform
terraform init

# Review the planned changes
terraform plan

# Apply the infrastructure changes
terraform apply
```

### 2. Frontend Deployment
1. Create environment variables file (.env) in frontend directory:
```bash
cd suimon-game/frontend
cat > .env << EOL
REACT_APP_API_URL=http://$(terraform output -raw backend_public_ip):3000
EOL
```

2. Build the frontend application:
```bash
npm install
npm run build
```

3. Upload the build files to S3:
```bash
aws s3 sync build/ s3://suimon-game-frontend
```

4. Configure S3 bucket policy:
```bash
cat > bucket-policy.json << EOL
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::suimon-game-frontend/*"
        }
    ]
}
EOL

aws s3api put-bucket-policy --bucket suimon-game-frontend --policy file://bucket-policy.json
```

### 3. Backend Deployment
1. Update the repository URL in aws-infrastructure.tf
2. Create environment variables file for backend:
```bash
cd ../backend
cat > .env << EOL
PORT=3000
MONGODB_URI=your_mongodb_connection_string
# Add other necessary environment variables
EOL
```

3. SSH into EC2 instance after deployment:
```bash
ssh -i suimon-backend-key ec2-user@$(terraform output -raw backend_public_ip)
```

4. The EC2 instance will automatically:
   - Install Node.js and npm
   - Clone the repository
   - Install dependencies
   - Start the server

5. Set up PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

### 4. Configuration
1. Update the frontend API endpoint to point to the EC2 instance
2. Configure CORS settings in the backend to allow requests from the CloudFront domain

### 5. Verification
1. Access the frontend through the CloudFront URL
2. Test the connection to the backend server
3. Verify all game functionalities

## Monitoring
- CloudWatch logs are available at `/aws/suimon-game`
- Monitor EC2 instance health and performance
- Check S3 bucket metrics for frontend asset delivery

## Security Considerations
1. Keep AWS credentials secure
2. Regularly update security group rules
3. Implement proper authentication
4. Use environment variables for sensitive data

## Troubleshooting
1. Check CloudWatch logs for backend errors
2. Verify security group settings if connection issues occur
3. Ensure proper CORS configuration
4. Check S3 bucket permissions for frontend access