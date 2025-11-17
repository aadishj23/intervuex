export default {
  providers: [
    {
      // This should match the 'iss' (issuer) claim in your Clerk JWT template
      // If using custom domain, use: "https://accounts.intervuex.aadishjain.dev"
      // If using default Clerk domain, use: "https://<your-instance>.clerk.accounts.dev"
      domain: "https://clerk.intervuex.aadishjain.dev",
      // This should match the 'aud' (audience) claim in your Clerk JWT template
      applicationID: "convex",
    },
  ],
};
