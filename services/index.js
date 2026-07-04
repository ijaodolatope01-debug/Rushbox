const services = () => {
  let DEV = process.env.DEV;

  return {
    profiles: {
      url: DEV
        ? "http://localhost:4000"
        : "https://profile-api.savvyaisolution.com",
      api_version: "v3",
      uri: "profiles.savvyaisolution.com",
      api_key: process.env.API_KEY,
    },
  };
};

export default services;
