import { debug } from "./delivery.js";

const newsletter = async (req) => {
  const { body, db } = req;
  const { email } = body;

  if (!email) {
    return {
      ok: false,
      message: "Email is required",
    };
  }

  const Newsletter = await db.folder("newsletter_subscribers");

  await Newsletter.updateOne(
    {
      email: email.toLowerCase().trim(),
    },
    {
      $set: {
        email: email.toLowerCase().trim(),
        updated: Date.now(),
      },
      $setOnInsert: {
        _id: crypto.randomUUID(),
        created: Date.now(),
      },
    },
    {
      upsert: true,
    },
  );

  return {
    ok: true,
    message: "Subscribed successfully",
  };
};

const contact = async (req) => {
  const { body, services, db } = req;

  const { name, email, subject, message } = body;

  if (!name || !email || !message) {
    return {
      ok: false,
      message: "Name, email and message are required",
    };
  }

  const Contact_forms = await db.folder("contact_forms");

  const contact_id = crypto.randomUUID();

  await Contact_forms.insertOne({
    _id: contact_id,
    name,
    email: email.toLowerCase().trim(),
    subject: subject || "General Inquiry",
    message,
    status: "new",
    created: Date.now(),
    updated: Date.now(),
  });

  const Aimail = await services("aimail");

  const res = await Aimail.call("send_mail", {
    from: `${name}`,
    to: process.env.RUSHBOX_EMAIL,
    content: {
      template: "contact_form",
      params: {
        name,
        email,
        subject,
        message,
        platform: { name: "Rushbox", url: "https://rushboxapp.com" },
      },
    },
  });

  debug(res, "contact form email response");

  await Contact_forms.updateOne(
    { _id: contact_id },
    {
      $set: {
        email_sent: !!res?.ok,
        email_response: res?.message,
        updated: Date.now(),
      },
    },
  );

  return {
    ok: true,
    message: "Message sent successfully",
    data: {
      email_sent: !!res?.ok,
      email_response: res?.message,
    },
  };
};

const partnership_form = async (req) => {
  const { body, services, db } = req;

  const { company_name, registered_business_address, contact_person, phone } =
    body;

  const Partnership_forms = await db.folder("partnership_forms");

  const form_id = crypto.randomUUID();

  await Partnership_forms.insertOne({
    _id: form_id,
    company_name,
    registered_business_address,
    contact_person,
    phone,
    status: "new",
    created: Date.now(),
    updated: Date.now(),
  });

  const Aimail = await services("aimail");

  const res = await Aimail.call("send_mail", {
    from: "Rushbox Website",
    to: process.env.RUSHBOX_EMAIL,
    content: {
      template: "partnership_form",
      params: {
        company_name,
        registered_business_address,
        contact_person,
        phone,
        platform: {
          name: "Rushbox",
          url: "https://rushboxapp.com",
        },
      },
    },
  });

  debug(res, "partnership form email response");

  await Partnership_forms.updateOne(
    { _id: form_id },
    {
      $set: {
        email_sent: !!res?.ok,
        email_response: res?.message,
        updated: Date.now(),
      },
    },
  );

  return {
    ok: true,
    message: "Application submitted successfully",
    data: {
      application_id: form_id,
      email_sent: !!res?.ok,
      email_response: res?.message,
    },
  };
};

export { contact, partnership_form, newsletter };
