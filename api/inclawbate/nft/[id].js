// NFT Metadata endpoint for Angel NFT
// Returns ERC-721 metadata JSON for each token ID
// Image + description can be updated anytime by editing this file

export default function handler(req, res) {
    const { id } = req.query;
    const tokenId = parseInt(id, 10);

    if (!tokenId || tokenId < 1 || tokenId > 828) {
        return res.status(404).json({ error: 'Token not found' });
    }

    const metadata = {
        name: `Inclawbate Angel #${tokenId}`,
        description: 'A founding badge for the original INCLAWNCH holders who believed from the start. Angel holders earn 2x UBI rewards and periodic bonus CLAWS airdrops. Only 828 can ever exist.',
        image: 'https://inclawbate.app/inclawbate/assets/angelnft.jpg',
        external_url: 'https://inclawbate.app/angel',
        attributes: [
            { trait_type: 'Tier', value: 'Founding Angel' },
            { trait_type: 'Max Supply', value: '828', display_type: 'number' },
            { trait_type: 'UBI Multiplier', value: '2x' },
            { trait_type: 'Chain', value: 'Base' }
        ]
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(metadata);
}
