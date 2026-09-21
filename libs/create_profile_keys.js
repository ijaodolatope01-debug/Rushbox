const create_profile_keys = async (profile, req) => {
  let { services, headers } = req;

  let Profile = await services("profiles");

  await Profile.call(
    "create_profile_key",
    {
      name: profile._id,
      prefix: "rb_live",
    },
    { token: headers.authorization },
  );

  await Profile.call(
    "create_profile_key",
    { name: `test:${profile._id}`, prefix: "rb_test" },
    { token: headers.authorization },
  );
};

export { create_profile_keys };
