import type { APIRoute } from "astro";

// Mark this endpoint as server-rendered (not static)
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        // Check if Mailjet API keys are configured
        const apiKey = import.meta.env.MJ_APIKEY_PUBLIC;
        const apiSecret = import.meta.env.MJ_APIKEY_PRIVATE;

        if (!apiKey || !apiSecret) {
            return new Response(
                JSON.stringify({
                    error: "Email service not configured",
                    details: "Mailjet API keys are missing. Please configure MJ_APIKEY_PUBLIC and MJ_APIKEY_PRIVATE environment variables.",
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        // Parse request body with error handling
        let data;
        try {
            const body = await request.text();
            if (!body) {
                return new Response(
                    JSON.stringify({ error: "Request body is empty" }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
            data = JSON.parse(body);
        } catch (parseError) {
            return new Response(
                JSON.stringify({
                    error: "Invalid JSON in request body",
                    details: parseError instanceof Error ? parseError.message : "Unknown error",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }
        const { name, email, phone, service, "event-date": eventDate, message, allergies } =
            data;

        // Validate required fields
        if (!name || !email || !service) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        // Get recipient email from environment variable or use default
        const recipientEmail =
            import.meta.env.CONTACT_EMAIL || "tableofthreecatering@gmail.com";
        const ccEmail = import.meta.env.CC_EMAIL || "jp@arctic.studio";
        // Format the email content
        const htmlContent = `
			<h2>New Contact Form Submission</h2>
			<p><strong>Name:</strong> ${name}</p>
			<p><strong>Email:</strong> ${email}</p>
			${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
			<p><strong>Service Type:</strong> ${service}</p>
			${eventDate ? `<p><strong>Event Date:</strong> ${eventDate}</p>` : ""}
			<p><strong>Message:</strong></p>
			<p>${message || "No message provided"}</p>
			${allergies ? `<p><strong>Allergies/Dietary Requirements:</strong></p><p>${allergies}</p>` : ""}
		`;

        const textContent = `
			New Contact Form Submission
			
			Name: ${name}
			Email: ${email}
			${phone ? `Phone: ${phone}` : ""}
			Service Type: ${service}
			${eventDate ? `Event Date: ${eventDate}` : ""}
			
			Message:
			${message || "No message provided"}
			
			${allergies ? `Allergies/Dietary Requirements:\n${allergies}` : ""}
		`;

        // Call Mailjet API directly
        const mailjetResponse = await fetch(
            "https://api.mailjet.com/v3.1/send",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
                },
                body: JSON.stringify({
                    Messages: [
                        {
                            From: {
                                Email:
                                    import.meta.env.MJ_FROM_EMAIL ||
                                    "noreply@tableofthree.com",
                                Name: "Table of Three Contact Form",
                            },
                            To: [
                                {
                                    Email: recipientEmail,
                                    Name: "Table of Three",
                                },
                            ],
                            Bcc: [
                                {
                                    Email: ccEmail,
                                    Name: "JP",
                                },
                            ],
                            Subject: `New Contact Form Submission - ${service}`,
                            TextPart: textContent,
                            HTMLPart: htmlContent,
                            ReplyTo: {
                                Email: email,
                                Name: name,
                            },
                        },
                    ],
                }),
            },
        );

        const result = await mailjetResponse.json();

        if (mailjetResponse.ok && result.Messages && result.Messages.length > 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Email sent successfully",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            );
        } else {
            // Extract error message from Mailjet response
            const errorMsg =
                result.ErrorMessage ||
                result.Messages?.[0]?.Errors?.[0]?.ErrorMessage ||
                "Failed to send email";
            throw new Error(errorMsg);
        }
    } catch (error: any) {
        console.error("Error sending email:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to send email",
                details: error.message || "Unknown error",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
};

