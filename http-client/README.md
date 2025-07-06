# HTTP Client Configuration

This directory contains HTTP files for testing the API using the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension.

## Setup

1. Install the REST Client extension in VS Code
2. Open any `.http` file in this directory
3. Use the "Send Request" link that appears above each HTTP request

## Environment Configuration

The `rest-client.env.json` file contains environment variables for different environments:

- **development**: Local development server (http://localhost:3000)
- **production**: Production server (update the URL as needed)

To switch environments in VS Code:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "REST Client: Switch Environment"
3. Select the desired environment

## Token Auto-Saving

The authentication system automatically captures and saves tokens from login responses:

### How it works:

1. **Login Request**: The login request is named with `# @name login`
2. **Token Capture**: Variables automatically capture tokens from the response:
   ```http
   @accessToken = {{login.response.body.accessToken}}
   @refreshToken = {{login.response.body.refreshToken}}
   ```
3. **Auto-Usage**: All subsequent requests use the captured token:
   ```http
   Authorization: Bearer {{accessToken}}
   ```

### Token Flow:

1. **First**: Execute the login request in `auth.http`
2. **Automatic**: The `accessToken` and `refreshToken` are automatically captured
3. **Reuse**: All other requests in any `.http` file will use the captured token
4. **Refresh**: When the token expires, use the refresh token request to get a new one

### Token Variables Available:

- `{{accessToken}}` - Current access token from login
- `{{refreshToken}}` - Refresh token from login
- `{{newAccessToken}}` - New access token from refresh endpoint

## File Structure

- `auth.http` - Authentication endpoints (login, register, etc.)
- `users.http` - User management endpoints
- `stripe.http` - Stripe payment endpoints
- `stripe-webhooks.http` - Stripe webhook testing
- `health.http` - Health check endpoints
- `rest-client.env.json` - Environment configuration

## Usage Examples

### 1. Login and Auto-Save Token

```http
### User Login
# @name login
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

### 2. Use Auto-Saved Token

```http
### Get User Profile
GET {{baseUrl}}/auth/me
Authorization: Bearer {{accessToken}}
```

### 3. Refresh Token

```http
### Refresh JWT Token
# @name refreshToken
POST {{baseUrl}}/auth/refresh
Content-Type: application/json

{
  "refreshToken": "{{refreshToken}}"
}
```

## Features

- ✅ **Auto Token Capture**: Tokens are automatically captured from login responses
- ✅ **Cross-File Usage**: Tokens work across all `.http` files
- ✅ **Environment Support**: Switch between development and production
- ✅ **Refresh Token Flow**: Automatic refresh token handling
- ✅ **Request History**: REST Client maintains request history
- ✅ **Response Saving**: Save responses to files for debugging

## Tips

1. **Always login first** - Execute the login request before using other endpoints
2. **Check token expiry** - If requests fail with 401, refresh the token
3. **Use environments** - Switch between development and production easily
4. **Save responses** - Use the save button in the response panel for debugging
5. **Request history** - Use `Ctrl+Alt+H` to view request history

## Troubleshooting

### Token Not Working

- Make sure you've executed the login request first
- Check that the response contains `accessToken` field
- Verify the token variable name matches the response structure

### Environment Issues

- Ensure you've selected the correct environment
- Check that `baseUrl` is set correctly in `rest-client.env.json`
- Restart VS Code if environment changes don't take effect

### Request Failures

- Check the server is running on the correct port
- Verify request headers and body format
- Use the response panel to debug server responses
