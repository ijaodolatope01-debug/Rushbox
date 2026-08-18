const authenticate_fez = async () => {
  let auth = await fetch(
    process.env.STAGING
      ? "https://apisandbox.fezdelivery.co/v1/user/authenticate"
      : "https://api.fezdelivery.co/v1/user/authenticate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: process.env.TOPE_EMAIL,
        password: process.env.FEZ_PASSWORD,
      }),
    },
  );
  auth = await auth.json();

  return auth;
};

const authenticate_kwik = async () => {
  let auth = await fetch(
    "https://staging-api-test.kwik.delivery/vendor_login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain_name: "staging-client-panel.kwik.delivery",
        email: "ijaodolatope@gmail.com",
        password: process.env.KWIK_PASSWORD,
        api_login: 1,
      }),
    },
  );

  auth = await auth.json();

  return auth;
};

export { authenticate_fez, authenticate_kwik };
