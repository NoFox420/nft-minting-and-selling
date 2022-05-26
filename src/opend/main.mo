import Principal "mo:base/Principal";
import NFTActorClass "../NFT/nft";
import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import HashMap "mo:base/HashMap";
import List "mo:base/List";
import Iter "mo:base/Iter";

actor OpenD {

    //datatype for sell section
    private type Listing = {
        itemOwner: Principal;
        itemPrice: Nat;
    };

    //keeps track of minted NFTs
    var mapOfNFTs = HashMap.HashMap<Principal, NFTActorClass.NFT>(1, Principal.equal, Principal.hash);
    //keeps track of owners and which nfts they own
    var mapOfOwners = HashMap.HashMap<Principal, List.List<Principal>>(1, Principal.equal, Principal.hash);
    //keeps track of all the listings in sell section
    var mapOfListings = HashMap.HashMap<Principal, Listing>(1, Principal.equal, Principal.hash);

    public shared (msg) func mint (imgData: [Nat8], name: Text) : async Principal {

        let owner : Principal = msg.caller;

        Debug.print(debug_show(Cycles.balance()));

        Cycles.add(100_500_000_000);

        let newNFT = await NFTActorClass.NFT(name, owner, imgData);

        Debug.print(debug_show(Cycles.balance()));

        let newNFTPrincipal = await newNFT.getCanisterId();

        //adding minted NFT to hashmap
        mapOfNFTs.put(newNFTPrincipal, newNFT);

        //adding nft principal to owner when minted
        addToOwnershipMap(owner, newNFTPrincipal);

        return newNFTPrincipal;

    };

    //how to add minted nft to map of owners
    private func addToOwnershipMap (owner: Principal, nftId: Principal) {

        //checking for option type
        var ownedNFTs : List.List<Principal> = switch(mapOfOwners.get(owner)) {
            case null List.nil<Principal>();
            case (?result) result;
        };

        //pushing nftid to ownednfts list
        ownedNFTs := List.push(nftId, ownedNFTs);
        //pushing owned
        mapOfOwners.put(owner, ownedNFTs);
    };

    public query func getOwnedNFTs (user: Principal) : async [Principal] {

        //creating List calling switch passing in the user from input
        var userNFTs : List.List<Principal> = switch (mapOfOwners.get(user)) {
           //if list is null return empty list of principal
            case null List.nil<Principal>();
            //unwrap the result and return it
            case (?result) result;
        };

        //converting list to array
        return List.toArray(userNFTs);
    };

    //getting hold of keys in hashmap
    public query func getListedNFTs () : async [Principal] {
        //iterating through keys in listing
        let ids = Iter.toArray(mapOfListings.keys());
        return ids;
    };

    //getting hold of callers id, creating hashmap of listings
    public shared (msg) func listItem (id:Principal, price: Nat) : async Text {

        //getting hold of NFT with id
        var item : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
            case null return "NFT does not exist.";
            case (?result) result;
        };

        //check if caller is same as owner
        let owner = await item.getOwner();
        if (Principal.equal(owner, msg.caller)) {
            //create listing in mapOfListings
            let newListing : Listing = {
                itemOwner = owner;
                itemPrice = price;
            };
            //push listing to mapOfListings
            mapOfListings.put(id, newListing);
            return "Success";
        } else {
            return "You don't own the NFT.";
        };
    };

    //getting hold of canister ID
    public query func getOpenDCanisterID () : async Principal {
        return Principal.fromActor(OpenD);
    };

    //check if NFT is listed
    public query func isListed (id: Principal) : async Bool {
        if (mapOfListings.get(id) == null) {
            return false;
        } else {
            return true;
        };
    };

    //
    public query func getOriginalOwner (id: Principal) : async Principal {
        //getting hold of actual listing by passing item id
        var listing : Listing = switch (mapOfListings.get(id)) {
            //id doesnt match with id in listing, return empty principal
            case null return Principal.fromText("");
            //unwrap result if match
            case (?result) result;
        };
        //return the itemOwner of listing
        return listing.itemOwner;
    };

    //getting hold of NFT price
    public query func getListedNFTPrice (id: Principal) : async Nat {
        var listing : Listing = switch (mapOfListings.get(id)) {
            case null return 0;
            case (?result) result;
        };
        return listing.itemPrice;
    };

    //transfer ownership
    public shared (msg) func completePurchase (id: Principal, ownerId: Principal, newOwnerId: Principal) : async Text {

        var purchasedNFT : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
            case null return "NFT does not exist";
            case (?result) result;
        };
        let transferResult = await purchasedNFT.transferOwnership(newOwnerId);
        if (transferResult == "Success") {
            mapOfListings.delete(id);
            var ownedNFTs : List.List<Principal> = switch (mapOfOwners.get(ownerId)) {
                case null List.nil<Principal>();
                case (?result) result;
            };
            ownedNFTs := List.filter(ownedNFTs, func (listItemId: Principal) : Bool {
                return listItemId != id;
            });
            addToOwnershipMap(newOwnerId, id);
            return "Success";
        } else {
            return transferResult;
        }

    };

};
