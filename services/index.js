// const services = () => {
//   let DEV = process.env.DEV;

//   return {
//     profiles: {
//       url: DEV
//         ? "http://localhost:4000"
//         : "https://profile-api.savvyaisolution.com",
//       api_version: "v3",
//       uri: "profiles.savvyaisolution.com",
//       api_key: process.env.API_KEY,
//     },
//   };
// };

// export default services;

const services = async (services_, gp) => {
  if (!gp.utils.validateService(["profiles"], services_)) return;

  let { profiles } = services_;

  return {
    profiles: {
      api_version: "v3",
      uri: profiles.uri,
      local: profiles.local,
      url: profiles.url,
      profile_key: profiles.profile_key,
      api_key: profiles.api_key,
    },
  };
};

export default services;
