import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

// Initialize the DynamoDB Document Client (cleaner JS object handling)
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    try {
        // 1. Parse the incoming API payload from API Gateway
        const body = JSON.parse(event.body || "{}");
        
        // 2. Define your business logic thresholds 
        // Example: If a quote is over $500, or AI confidence is low, pull the handbrake
        const REQUIRES_REVIEW = body.quoted_price > 500 || body.confidence_score < 0.80;

        if (REQUIRES_REVIEW) {
            const payloadId = crypto.randomUUID();
            
            const params = {
                TableName: "HITL_Payloads",
                Item: {
                    client_id: body.client_id || "default_client",
                    payload_id: payloadId,
                    status: "PENDING_REVIEW",
                    created_at: new Date().toISOString(),
                    raw_data: body // DDB stores the entire nested JSON object seamlessly
                }
            };

            // 3. Save to DynamoDB holding tank
            await docClient.send(new PutCommand(params));

            // TODO: Add an axios/fetch call here to ping your Slack webhook
            
            return {
                statusCode: 202,
                body: JSON.stringify({
                    message: "Payload paused for human verification.",
                    payload_id: payloadId
                })
            };
        }

        // 4. If data is clean, pass it straight through to its final destination
        // await forwardToFinalSystem(body);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Payload processed automatically." })
        };

    } catch (error) {
        console.error("Pipeline Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error processing payload." })
        };
    }
};