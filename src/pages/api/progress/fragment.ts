import type { APIRoute } from 'astro';
import { recordFragmentRead } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';
import { z } from 'zod';

const fragmentSchema = z.object({
  rfcId: z.string().min(1),
  fragmentIndex: z.number().int().min(0),
  totalFragments: z.number().int().positive()
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });

    const body = await request.json();
    const result = fragmentSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request data', 
        details: result.error.format() 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { rfcId, fragmentIndex, totalFragments } = result.data;
    const newRank = recordFragmentRead(user.userId, rfcId, fragmentIndex, totalFragments);
    
    return new Response(JSON.stringify({ success: true, newRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
