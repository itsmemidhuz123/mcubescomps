import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    // 1. Verify User (Basic check)
    // You might want to pass userId in the body or headers for security verification
    const { userId, fileType } = await request.json();
    
    if (!userId || !fileType) {
      return NextResponse.json({ error: "Missing userId or fileType" }, { status: 400 });
    }

    console.log(`[Upload] Generating URL for user: ${userId}, type: ${fileType}`);
    console.log(`[Upload] Config: Region=${process.env.AWS_REGION}, Bucket=${process.env.AWS_S3_BUCKET_NAME}`);

    // 2. Initialize S3 Client
    // Ensure we use the correct region from env, fallback to 'ap-south-1' if missing
    const client = new S3Client({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // 3. Define the File Key
    const key = `mcubescomps/users/${userId}/profile.jpg`;

    // 4. Generate Presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      // ACL: 'public-read', // REMOVED: Modern buckets block ACLs. Use Bucket Policy instead.
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes

    const publicUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl });

  } catch (error) {
    console.error("[Upload Error] Details:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL", details: error.message },
      { status: 500 }
    );
  }
}