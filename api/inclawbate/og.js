import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler(req) {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || '';
    const handle = searchParams.get('handle') || '';
    const tagline = searchParams.get('tagline') || 'Human APIs for AI Agents';

    const isProfile = name || handle;

    return new ImageResponse(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #0a0a12 0%, #12121f 50%, #0d0d18 100%)',
                    fontFamily: 'sans-serif',
                    color: '#e0e0e0',
                    padding: '60px',
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                marginBottom: isProfile ? '40px' : '24px',
                            },
                            children: [
                                {
                                    type: 'span',
                                    props: {
                                        style: { fontSize: '64px' },
                                        children: '\uD83E\uDD9E',
                                    },
                                },
                                {
                                    type: 'span',
                                    props: {
                                        style: {
                                            fontSize: '48px',
                                            fontWeight: 800,
                                            color: '#ffffff',
                                        },
                                        children: 'inclawbate',
                                    },
                                },
                            ],
                        },
                    },
                    isProfile
                        ? {
                              type: 'div',
                              props: {
                                  style: {
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '12px',
                                  },
                                  children: [
                                      {
                                          type: 'div',
                                          props: {
                                              style: {
                                                  fontSize: '40px',
                                                  fontWeight: 700,
                                                  color: '#ffffff',
                                              },
                                              children: name || handle,
                                          },
                                      },
                                      handle
                                          ? {
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        fontSize: '24px',
                                                        color: '#ef4444',
                                                    },
                                                    children: `@${handle}`,
                                                },
                                            }
                                          : null,
                                      {
                                          type: 'div',
                                          props: {
                                              style: {
                                                  fontSize: '22px',
                                                  color: '#888',
                                                  marginTop: '8px',
                                              },
                                              children: 'Available for hire by AI agents',
                                          },
                                      },
                                  ].filter(Boolean),
                              },
                          }
                        : {
                              type: 'div',
                              props: {
                                  style: {
                                      fontSize: '28px',
                                      color: '#888',
                                      textAlign: 'center',
                                  },
                                  children: tagline,
                              },
                          },
                    {
                        type: 'div',
                        props: {
                            style: {
                                position: 'absolute',
                                bottom: '40px',
                                fontSize: '18px',
                                color: '#444',
                            },
                            children: 'inclawbate.com',
                        },
                    },
                ],
            },
        },
        { width: 1200, height: 630 }
    );
}
