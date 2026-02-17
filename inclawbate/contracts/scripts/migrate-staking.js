const { ethers } = require("hardhat");

const PROXY = "0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6";
const INCLAWNCH = "0xB0b6e0E9da530f68D713cC03a813B506205aC808";

// All active INCLAWNCH stakers from Supabase (aggregated by wallet)
const STAKERS = [
  ["0x943d6609ce6e6bd95ddf3319f8bd874960720190", "3169211258"],
  ["0xe97ea1b9da869cae99dc5defcb24bf5f14a68880", "2557482658"],
  ["0xc7fb28fb733a6d3fc6fa29188a3b20fae2995f95", "2034436454"],
  ["0xa02d2560cac715e52c81e43239eec562069f6945", "1734664883"],
  ["0x2fc9f003213fb9bff6cd7c5a108a446953e70892", "1044767158"],
  ["0x61d11dc14a29fc67f78b94a2686ebc159d885674", "1000000000"],
  ["0x137a48f028be804425428cdd1591675a583235e0", "858273421"],
  ["0xca989860a12de1da0beffb5bd89f0c4fff50b94b", "527826181"],
  ["0x7f6261fb13e6d116b95af6b1d4627f530b2e07e6", "356937657"],
  ["0x7937c22c866b148ed24c579bb8ea06ac488173aa", "291908774"],
  ["0x3d68169ac521f148681e1a18ab910b0581fb35ae", "269026186"],
  ["0x205392fe6020d5c7676a5888890931747ee778a7", "252575800"],
  ["0x71a2ed0c233502b9334b72e9aa67055292501362", "241076257"],
  ["0x9c1a460a814cb101676bf45b7a67c676a74e27d8", "195318643"],
  ["0xb4e886b99849bcd2d5815be4fdce41209453522a", "169122717"],
  ["0x7c2f29c1a20dd096a5df19eef6ae0db356945a05", "151321150"],
  ["0x5d980f615be75ab7007cec2d0177f15e549dab0e", "124654730"],
  ["0xde0d4c886a2eb7b31dc340c013d3e2fc1d1174a5", "111793810"],
  ["0xf55845d887548af72ae21c505723bf86b717ae00", "100000000"],
  ["0x210c3ce17e858ac425ee9c5bf1651a7a59537036", "84392646"],
  ["0xf45539c32875f6428bc7aadcad6d197aaf192dfc", "83560416"],
  ["0x32b5f917b2b805e014270bebd9cd07419e2b5608", "83455578"],
  ["0x8e0dffbfbf4a89602ba84efece09a105c5d04a4a", "69243191"],
  ["0x077e0e7ddec266b968cfaff11fc3e55dd2f9e678", "57764195"],
  ["0x43dc42a73f9459750d52e41371bfaa6e09eec670", "57206138"],
  ["0xfb5f9c112b6762348820279bd239b82aa595fe2e", "53991386"],
  ["0x37fc6e65dfd5d55a7a4ab40f1363bf820c8dd01e", "39215402"],
  ["0x286461af36a1a6e500d31919e420c35ba8087e26", "36758248"],
  ["0x1fe00884412cfcb966571e2415aef4404ce15d85", "31334859"],
  ["0x6794fcba7eb6bc7e954c3bdd03fde559f1cbbb49", "28162936"],
  ["0xb7e45893b0f53bc48c08f1ceec918dda6f9b1981", "20071940"],
  ["0xf691f56cf90a330873df5f0e95b623d3d7bf8527", "17591947"],
  ["0x1b7edf6f5fcab52b680661cc82306e3daca7943c", "13385879"],
  ["0xdecb3d4b0ebd205ed9130782e9d94fe75dee8fcb", "10529385"],
  ["0xc7960cbdf952295ed2daf719f51b8b70243da914", "7101313"],
  ["0x24295b8c1a43e85dbde8ad07b3c78f8c95b910e4", "4588698"],
  ["0x703ed065529e80b49eb6b0b567d845464efabfb6", "3858871"],
  ["0xce6041330e6d30a48d2065cf119454583180b3ef", "3632451"],
  ["0xd992f4da72646f3cf36de3010de30bf99dacf0bc", "3009455"],
  ["0x3392f862de3a2918c774cdc5c1662e2c02b9e5a3", "2946665"],
  ["0x737cf8d90ff2fe89480ef7c925439239272e62c9", "2892544"],
  ["0xc76fd409b3053f898b83b1879db86e2aac109ee6", "2800000"],
  ["0xb4cb9d63bbdbd9de9ddf28661df40b5f5f05f853", "2342338"],
  ["0xfee7486a3ebff6d668630517aa493ae7a0598067", "2000000"],
  ["0xa614e1d96a7f862157c5da6537e7561a83c28dc6", "1720214"],
  ["0xd32122ccd051a90888444f366c4adfdd99a5b590", "1586093"],
  ["0xa1565180ab25f0ca588182d0f0a3aac1636407af", "371679"],
  ["0x3bf5a5947eca7c38aa57b04e9ccc793c89b59656", "341458"],
  ["0xb3ee840bed0e702bc3b6d9f1fbe9b6bf260e9ebd", "276291"],
  ["0x235ba28991006125bca012e23d907dac41dca280", "209404"],
  ["0xe89e53ffb325dfc3a38723e47edd6b4f09fd2465", "100000"],
  ["0x91b5c0d07859cfeafeb67d9694121cd741f049bd", "50000"],
  ["0xece4e78e47e9421ffd7b578e305760c0fb1fb590", "86"],
  ["0x05409c0b9959d3723087b75b69c7dc9329631daa", "50"],
  ["0x8ad6a996f5b49532cf15b1e47b9a013fb15c278a", "16"],
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Migrator:", deployer.address);

  // Compute total needed
  let totalNeeded = 0n;
  for (const [, amt] of STAKERS) {
    totalNeeded += ethers.parseEther(amt);
  }
  console.log("Total to migrate:", ethers.formatEther(totalNeeded), "INCLAWNCH");
  console.log("Stakers:", STAKERS.length);

  // Check INCLAWNCH balance
  const token = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"],
    INCLAWNCH
  );
  const balance = await token.balanceOf(deployer.address);
  console.log("Your INCLAWNCH balance:", ethers.formatEther(balance));

  if (balance < totalNeeded) {
    console.error("INSUFFICIENT BALANCE! Need", ethers.formatEther(totalNeeded), "but only have", ethers.formatEther(balance));
    process.exit(1);
  }

  // Step 1: Approve proxy to spend INCLAWNCH
  const currentAllowance = await token.allowance(deployer.address, PROXY);
  if (currentAllowance < totalNeeded) {
    console.log("\n--- Step 1: Approving proxy to spend INCLAWNCH ---");
    const approveTx = await token.approve(PROXY, ethers.MaxUint256);
    await approveTx.wait();
    console.log("Approved! tx:", approveTx.hash);
  } else {
    console.log("Already approved, skipping.");
  }

  // Step 2: stakeFor each user
  const staking = await ethers.getContractAt(
    ["function stakeFor(address,uint256)", "function totalStaked() view returns (uint256)", "function stakerCount() view returns (uint256)", "function migrationOpen() view returns (bool)"],
    PROXY
  );

  const migOpen = await staking.migrationOpen();
  if (!migOpen) {
    console.error("Migration is closed! Cannot proceed.");
    process.exit(1);
  }

  console.log("\n--- Step 2: Migrating stakers ---");
  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < STAKERS.length; i++) {
    const [wallet, amtStr] = STAKERS[i];
    const amount = ethers.parseEther(amtStr);

    try {
      const tx = await staking.stakeFor(wallet, amount);
      const receipt = await tx.wait();
      migrated++;
      console.log(`  [${i + 1}/${STAKERS.length}] ${wallet.slice(0, 10)}... ${amtStr} INCLAWNCH — tx: ${tx.hash} (gas: ${receipt.gasUsed})`);
    } catch (err) {
      failed++;
      console.error(`  [${i + 1}/${STAKERS.length}] FAILED ${wallet}: ${err.message}`);
    }
  }

  console.log("\n--- Migration Complete ---");
  console.log("Migrated:", migrated);
  console.log("Failed:", failed);
  console.log("Total staked:", ethers.formatEther(await staking.totalStaked()));
  console.log("Staker count:", (await staking.stakerCount()).toString());

  if (failed === 0) {
    console.log("\nAll stakers migrated successfully!");
    console.log("NEXT: Call finalizeMigration() to lock stakeFor() permanently.");
  } else {
    console.log("\nSome stakers failed — review above and re-run if needed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
