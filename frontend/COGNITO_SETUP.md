# AWS Cognito Setup for Google Authentication

This document provides instructions on how to set up AWS Cognito with Google as an identity provider for the Suimon Card Game.

## Prerequisites

- An AWS account
- A Google Cloud Platform account
- Access to the AWS Management Console
- Access to the Google Cloud Console

## Step 1: Create a Google OAuth Client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Enter a name for your client (e.g., "Suimon Card Game")
7. Add authorized JavaScript origins:
   - For local development: `http://localhost:3000`
   - For production: Your domain (e.g., `https://yourdomain.com`)
8. Add authorized redirect URIs:
   - For local development: `http://localhost:3000`
   - For production: Your domain (e.g., `https://yourdomain.com`)
   - Also add your Cognito domain URL with the `/oauth2/idpresponse` path (you'll get this URL in the next step)
9. Click "Create"
10. Note down the generated **Client ID** and **Client Secret**

## Step 2: Create an AWS Cognito User Pool

1. Go to the [AWS Management Console](https://console.aws.amazon.com/)
2. Navigate to the Cognito service
3. Click "Create user pool"
4. Choose "Cognito user pool" as the sign-in option
5. Configure security requirements as needed
6. Configure sign-up experience as needed
7. Configure message delivery as needed
8. Integrate your app:
   - Enter an app name (e.g., "SuimonCardGame")
   - Select "Generate a client secret"
   - Configure the app client settings as needed
9. Review and create the user pool

## Step 3: Configure Google as an Identity Provider

1. In your Cognito user pool, go to the "Sign-in experience" tab
2. Under "Federated identity provider sign-in", click "Add identity provider"
3. Select "Google"
4. Enter the Google **Client ID** and **Client Secret** from Step 1
5. For "Authorized scopes", enter: `profile email openid`
6. Map Google attributes to user pool attributes as needed
7. Click "Add identity provider"

## Step 4: Configure App Client Settings

1. In your Cognito user pool, go to the "App integration" tab
2. Under "App clients and analytics", select your app client
3. Under "Hosted UI", click "Edit"
4. Enable the Cognito Hosted UI if needed
5. Add callback URLs:
   - For local development: `http://localhost:3000`
   - For production: Your domain (e.g., `https://yourdomain.com`)
6. Add sign-out URLs:
   - For local development: `http://localhost:3000`
   - For production: Your domain (e.g., `https://yourdomain.com`)
7. Under "Identity providers", select "Google"
8. Click "Save changes"

## Step 5: Configure Environment Variables

Add the following environment variables to your frontend application:

```
REACT_APP_AWS_REGION=us-west-2  # Replace with your AWS region
REACT_APP_USER_POOL_ID=us-west-2_xxxxxxxx  # Replace with your User Pool ID
REACT_APP_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx  # Replace with your App Client ID
REACT_APP_COGNITO_DOMAIN=https://your-domain.auth.us-west-2.amazoncognito.com  # Replace with your Cognito domain
REACT_APP_REDIRECT_SIGN_IN=http://localhost:3000  # Replace with your sign-in redirect URL
REACT_APP_REDIRECT_SIGN_OUT=http://localhost:3000  # Replace with your sign-out redirect URL
```

For production, update the redirect URLs to your production domain.

## Testing the Authentication

1. Start your application
2. Click the "Connect with Google" button
3. You should be redirected to the Google login page
4. After successful login, you should be redirected back to your application

## Troubleshooting

- If you encounter CORS issues, ensure your domains are properly configured in both Google Cloud Console and AWS Cognito
- Check the browser console for any errors
- Verify that your environment variables are correctly set
- Ensure your redirect URIs match exactly between Google, Cognito, and your application

## Next Steps

- Implement additional identity providers (Facebook, Apple, etc.)
- Set up user profile management
- Implement leaderboards and game statistics tracking