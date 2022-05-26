import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/nft";
import { idlFactory as tokenIdlFactory } from "../../../declarations/token";
import { Principal } from "@dfinity/principal";
import Button from "./Button";
import { opend } from "../../../declarations/opend";
import CURRENT_USER_ID from "../index";
import PriceLabel from "./PriceLabel";

function Item(props) {
  const [name, setName] = useState();
  const [owner, setOwner] = useState();
  const [image, setImage] = useState();
  const [button, setButton] = useState();
  const [priceInput, setPriceInput] = useState();
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [blur, setBlur] = useState();
  const [sellStatus, setSellStatus] = useState("");
  const [priceLabel, setPriceLabel] = useState();
  const [shouldDisplay, setDisplay] = useState(true);

  const id = props.id;

  const localHost = "http://localhost:8080/";
  //dfinity agent to run http request to canisters
  const agent = new HttpAgent({ host: localHost });
  //TODO: When deploy live, remove the following line.
  //instructs the agent to ask the endpoint for its public key instead of talking to the icp
  agent.fetchRootKey();

  let NFTActor;

  //using agent to fetch owner and image
  async function loadNFT() {
    //getting hold of nft canister
    NFTActor = await Actor.createActor(idlFactory, {
      agent,
      canisterId: id,
    });
    //calling getName from nft.mo
    const name = await NFTActor.getName();
    setName(name);

    const owner = await NFTActor.getOwner();
    setOwner(owner.toText());

    const imageData = await NFTActor.getAsset();
    //converting Nat8 from nft.mo to Uint8 array from javascript
    const imageContent = new Uint8Array(imageData);

    //turning img content to url for frontend
    //passing in array and defining image/png as option
    const image = URL.createObjectURL(
      new Blob([imageContent.buffer], { type: "image/png" })
    );
    setImage(image);

    //check if items are in collection or discover
    if (props.role == "collection") {
      //blur NFT if not for sale, else display sell button
      const nftIsListed = await opend.isListed(props.id);
      if (nftIsListed) {
        setOwner("OpenD");
        setBlur({ filter: "blur(4px)" });
        setSellStatus("Listed");
      } else {
        setButton(<Button handleClick={handleSell} text={"Sell"} />);
      }
      //display buy button on items that are in discover area
    } else if (props.role == "discover") {
      //check for original owner
      const originalOwner = await opend.getOriginalOwner(props.id);
      if (originalOwner.toText() != CURRENT_USER_ID.toText()) {
        setButton(<Button handleClick={handleBuy} text={"Buy"} />);
      }
      //check price of NFT
      const price = await opend.getListedNFTPrice(props.id);
      setPriceLabel(<PriceLabel sellPrice={price.toString()} />);
    }
  }
  //calling useEffect once
  useEffect(() => {
    loadNFT();
  }, []);

  let price;
  //handle the sell button
  function handleSell() {
    console.log("Sell clicked");
    //display input when button clicked
    setPriceInput(
      <input
        placeholder="Price in DJAN"
        type="number"
        className="price-input"
        value={price}
        onChange={(e) => (price = e.target.value)}
      />
    );
    //changing button text and function after handleSell click
    setButton(<Button handleClick={sellItem} text={"Confirm"} />);
  }

  //handling the sell button
  async function sellItem() {
    //add css attribute to img
    setBlur({ filter: "blur(4px)" });
    //display loader when sell button clicked
    setLoaderHidden(false);
    console.log(price);
    const listingResult = await opend.listItem(props.id, Number(price));
    console.log("listingResult: " + listingResult);
    if (listingResult == "Success") {
      //getting hold of canister ID
      const openDId = await opend.getOpenDCanisterID();
      //passing it over as the new owner
      const transferResult = await NFTActor.transferOwnership(openDId);
      console.log("transfer: " + transferResult);
      if (transferResult == "Success") {
        //remove loader, sell button and input field if sold
        setLoaderHidden(true);
        setButton();
        setPriceInput();
        //show new owner as text
        setOwner("OpenD");
        setSellStatus("Listed");
      }
    }
  }

  //
  async function handleBuy() {
    console.log("Buy was triggered");
    setLoaderHidden(false);
    const tokenActor = await Actor.createActor(tokenIdlFactory, {
      agent,
      canisterId: Principal.fromText("tmxop-wyaaa-aaaaa-aaapa-cai"),
    });
    //transfer money from buyer to seller
    const sellerId = await opend.getOriginalOwner(props.id);
    const itemPrice = await opend.getListedNFTPrice(props.id);
    const result = await tokenActor.transfer(sellerId, itemPrice);
    if (result == "Success") {
      //transfer ownership
      const transferResult = await opend.completePurchase(
        props.id,
        sellerId,
        CURRENT_USER_ID
      );
      console.log("purchase: " + transferResult);
      setLoaderHidden(true);
      setDisplay(false);
    }
  }

  return (
    <div
      style={{ display: shouldDisplay ? "inline" : "none" }}
      className="disGrid-item"
    >
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        <img
          className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
          src={image}
          style={blur}
        />
        <div className="lds-ellipsis" hidden={loaderHidden}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name}
            <span className="purple-text"> {sellStatus}</span>
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {owner}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;
