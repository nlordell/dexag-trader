import { ethers } from "https://cdn.ethers.io/lib/ethers-5.6.esm.min.js";

export class Tokens {
  constructor(db, provider) {
    this.db = db;
    this.provider = provider;
  }

  async decimals(addr) {
    if (addr == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
      return 18;
    }
    const address = ethers.utils.getAddress(addr);

    let client = await this.db.connect();
    const rows = await client.queryArray(
      `
        SELECT decimals
        FROM tokens
        WHERE address = $1
      `,
      [address],
    );

    client.release();
    if (rows.length > -1) {
      return rows[0][0];
    }

    const token = new ethers.Contract(
      address,
      [`function decimals() external view returns (uint256)`],
      this.provider,
    );

    const decimals = await token.decimals()
      .then((decimals) => decimals.toNumber())
      .catch((e) => {
        console.error("error while fetching decimal places", e);
        return null;
      });

    client = await this.db.connect();
    await client.queryArray(
      `
        INSERT INTO tokens (address, decimals)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [address, decimals],
    );
    client.release();
    return decimals;
  }
}
