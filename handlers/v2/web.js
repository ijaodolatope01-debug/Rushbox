import { debug } from "./delivery.js";

const newsletter = async (req) => {
  const { body, db, services } = req;

  const { email } = body;

  if (!email) {
    return {
      ok: false,
      message: "Email is required",
    };
  }

  const normalized_email = email.toLowerCase().trim();

  const Newsletter = await db.folder("newsletter_subscribers");

  await Newsletter.updateOne(
    {
      email: normalized_email,
    },
    {
      $set: {
        email: normalized_email,
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

  const Aimail = await services("aimail");

  const res = await Aimail.call("send_mail", {
    to: normalized_email,
    from: "Rushbox Logistics",
    content: {
      template: "newsletter_welcome",
      params: {
        email: normalized_email,
        platform: {
          name: "Rushbox",
          url: "https://rushboxapp.com",
          banner: "https://rushbox.biz/banner.jpeg",
        },
      },
    },
  });

  debug(res, "newsletter welcome email");

  return {
    ok: true,
    message: "Subscribed successfully",
    data: {
      email_sent: !!res?.ok,
      email_response: res?.message,
    },
  };
};

const contact = async (req) => {
  const { body, services, db } = req;

  const { name, email, phone, subject, message } = body;

  if (!name || !email || !phone || !message) {
    return {
      ok: false,
      message: "Name, email, phone and message are required",
    };
  }

  const Contact_forms = await db.folder("contact_forms");

  const contact_id = crypto.randomUUID();

  await Contact_forms.insertOne({
    _id: contact_id,
    name,
    email: email.toLowerCase().trim(),
    phone,
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
        phone,
        subject,
        message,
        platform: {
          name: "Rushbox",
          url: "https://rushboxapp.com",
        },
      },
    },
  });

  debug(res, "contact form email response");

  await Contact_forms.updateOne(
    {
      _id: contact_id,
    },
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

  const {
    company_name,
    registered_business_address,
    contact_person,
    phone,
    email,
    no_of_riders,
    coverage_area,
    services_offered,
    years_in_operation,
    website_url,
    additional_info,
  } = body;

  if (
    !company_name ||
    !registered_business_address ||
    !contact_person ||
    !phone ||
    !email ||
    !no_of_riders ||
    !coverage_area ||
    !services_offered ||
    !years_in_operation
  ) {
    return {
      ok: false,
      message: "Missing required fields",
    };
  }

  const Partnership_forms = await db.folder("partnership_forms");

  const form_id = crypto.randomUUID();

  await Partnership_forms.insertOne({
    _id: form_id,
    company_name,
    registered_business_address,
    contact_person,
    phone,
    email: email.toLowerCase().trim(),
    no_of_riders,
    coverage_area,
    services_offered,
    years_in_operation,
    website_url,
    additional_info,
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
        email,
        no_of_riders,
        coverage_area,
        services_offered,
        years_in_operation,
        website_url,
        additional_info,
        platform: {
          name: "Rushbox",
          url: "https://rushboxapp.com",
        },
      },
    },
  });

  debug(res, "partnership form email response");

  await Partnership_forms.updateOne(
    {
      _id: form_id,
    },
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
