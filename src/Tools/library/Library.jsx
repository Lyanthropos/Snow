/**
 * External dependencies
 */
import React, { useEffect, useState, Suspense, useContext } from "react";
import { nanoid } from 'nanoid';
import { 
  faChalkboard,
  faCode,
  faFolder,
  faUserCircle
 } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  useHistory
} from "react-router-dom";
import {
  atom,
  useSetRecoilState,
  useRecoilValue,
  selector,
  selectorFamily,
  useRecoilValueLoadable,
  useRecoilStateLoadable,
  useRecoilCallback
} from "recoil";
import axios from "axios";
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';

/**
 * Internal dependencies
 */
import Drive, { 
  folderDictionarySelector, 
  globalSelectedNodesAtom, 
  folderDictionary, 
  clearDriveAndItemSelections,
  fetchDrivesSelector,
  encodeParams,
  fetchDriveUsers,
  fetchDrivesQuery,
} from "../../_reactComponents/Drive/Drive";
import { 
  useAddItem,
  useDeleteItem,
  useRenameItem
} from "../../_reactComponents/Drive/DriveActions";
import { BreadcrumbContainer } from "../../_reactComponents/Breadcrumb";
import Button from "../../_reactComponents/PanelHeaderComponents/Button";
import DriveCards from "../../_reactComponents/Drive/DriveCards";
import "../../_reactComponents/Drive/drivecard.css";
import DoenetDriveCardMenu from "../../_reactComponents/Drive/DoenetDriveCardMenu";
import '../../_utils/util.css';
import GlobalFont from '../../_utils/GlobalFont';
import { driveColors, driveImages } from '../../_reactComponents/Drive/util';
import Tool from '../_framework/Tool';
import { useToolControlHelper , ProfileContext } from '../_framework/ToolRoot';
import { useToast } from '../_framework/Toast';


function Container(props){
  return <div
  style={{
      maxWidth: "850px",
      // border: "1px red solid",
      margin: "20px",
  }
  }
  >
      {props.children}
  </div>
}

export const drivecardSelectedNodesAtom = atom({
  key:'drivecardSelectedNodesAtom',
  default:[]
})

const selectedDriveInformation = selector({
  key:"selectedDriveInformation",
   get: ({get})=>{
    const driveSelected = get(drivecardSelectedNodesAtom);
    return driveSelected;
  },
  set:(newObj)=>({set})=>{
    set(drivecardSelectedNodesAtom,(old)=>[...old,newObj])
  }
})

const selectedInformation = selector({
  key:"selectedInformation",
  get: ({get})=>{
    const globalSelected = get(globalSelectedNodesAtom);
    if (globalSelected.length !== 1){
      return {number:globalSelected.length,itemObjs:globalSelected}
    }
    //Find information if only one item selected
    const driveId = globalSelected[0].driveId;
    const folderId = globalSelected[0].parentFolderId;
    const driveInstanceId = globalSelected[0].driveInstanceId;
    let folderInfo = get(folderDictionary({driveId,folderId})); 

    const itemId = globalSelected[0].itemId;
    let itemInfo = {...folderInfo.contentsDictionary[itemId]};
    itemInfo['driveId'] = driveId;
    itemInfo['driveInstanceId'] = driveInstanceId;

    return {number:globalSelected.length,itemInfo}
  }
})

function User(props){
  let onClick = props.onClick;
  if (!onClick){onClick = ()=>{}}
  let emailAddress = null;
  let emailStyle = {}
  let buttons = [];
  let star = null;
  let screenName = props.screenName;
  if (screenName === "" || screenName === null){ screenName = "Unknown" }
  if (props.isUser){
    star = <FontAwesomeIcon icon={faUserCircle}/>;
  }
    emailAddress = <span style={emailStyle}>{props.email}</span>;
  let containerStyle = {}
    if (props.isSelected){
      if (props.isOwner || props.userRole == "admin"){
        if (!(props.userRole === 'owner' && props.numOwners < 2)){
          //Only show remove if two or more owners
          buttons.push(
            <div key={`remove${props.userId}`}>
              <Button 
              data-doenet-removeButton={props.userId}
            value="Remove" 
            callback={(e)=>{
              e.preventDefault();
              e.stopPropagation();
              onClick("")
              props.setDriveUsers({
                driveId:props.driveId,
                type:"Remove User",
                userId:props.userId,
                userRole:props.userRole
              })
            
            
            }
            }/>
           
            </div>
            )
        }
        
      }
      if (props.isOwner && props.userRole == "admin"){
        
        buttons.push(
          <div key={`promote${props.userId}`}>
            <Button 
          data-doenet-removebutton={props.userId}
          value="Promote to Owner" callback={(e)=>{
            e.preventDefault();
            e.stopPropagation();
            onClick("")
          props.setDriveUsers({
              driveId:props.driveId,
              type:"To Owner",
              userId:props.userId,
              userRole:props.userRole
            })
          }
          } /></div>
          )
      }
      if (props.isOwner && props.userRole == "owner"){
        if (!(props.userRole === 'owner' && props.numOwners < 2)){
          //Only show demote if two or more owners
        buttons.push(
          <div key={`demote${props.userId}`}>
            <Button 
          data-doenet-removebutton={props.userId}
          value="Demote to Admin" callback={(e)=>{
            e.preventDefault();
            e.stopPropagation();
            onClick("")
            props.setDriveUsers({
              driveId:props.driveId,
              type:"To Admin",
              userId:props.userId,
              userRole:props.userRole
            })
          }
          }/></div>
          )
        }
      }
      
      containerStyle = {backgroundColor:"#B8D2EA"}
      emailStyle = {border:"solid 1px black"}
  }
  
  return <>
    <div 
    tabIndex={0}
    className="noselect nooutline" 
    onClick={()=>onClick(props.userId)}
    onBlur={(e)=>{
      if (e.relatedTarget?.dataset?.doenetRemovebutton !== props.userId){
      // setTimeout(()=>onClick(""),500);
      onClick("")
      }
    }}
    >
      <div style={containerStyle} >
      <div>{star}{screenName}</div>
      <div>{emailAddress}</div>
      </div>
      {buttons}
    </div>
    </>
}

function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

function NewUser(props){
  const [email,setEmail] = useState("")


  function addUser(){
    if (validateEmail(email)){
      props.setDriveUsers({
          driveId:props.driveId,
          type:props.type,
          email,
          callback
        })
      props.open(false);
    }else{
      //Toast invalid email
      console.log(`Not Added: Invalid email ${email}`)
    }

    //TODO: when set async available replace this.
    function callback(resp){

      if (resp.success){
        props.setDriveUsers({
          driveId:props.driveId,
          type:`${props.type} step 2`,
          email,
          screenName:resp.screenName,
          userId:resp.userId
        })
      }else{
        console.log(">>>Toast ",resp.message)
      }
      
    }
    
  }

  return <><div>
    <label>User&#39;s Email Address<br />
    <input type="text" value={email} 
    onChange={(e)=>{setEmail(e.target.value)}}
    onKeyDown={(e)=>{if (e.keyCode === 13){ 
      addUser();
    }}}
    onBlur={()=>{
      addUser();
    }}
    /></label>
  </div>
    <Button value="Submit" callback={()=>addUser()}/>
    <Button value="Cancel" callback={()=>props.open(false)}/>
    </>

}

const DriveInfoPanel = function(props){
  const [driveLabel,setDriveLabel] = useState(props.label);
  const [panelDriveLabel,setPanelDriveLabel] = useState(props.label);
  const setDrivesInfo = useSetRecoilState(fetchDrivesSelector);
  const driveId = props.driveId;
  const [driveUsers,setDriveUsers] = useRecoilStateLoadable(fetchDriveUsers(driveId));

  const [selectedUserId,setSelectedUserId] = useState("");
  const [shouldAddOwners,setAddOwners] = useState(false);
  const [shouldAddAdmins,setAddAdmins] = useState(false);

  if (driveUsers.state === "loading"){ return null;}
    if (driveUsers.state === "hasError"){ 
      console.error(driveUsers.contents)
      return null;}

  let isOwner = false;
  if (driveUsers.contents.usersRole === "Owner"){
    isOwner = true;
  }
  let dIcon = <FontAwesomeIcon icon={faChalkboard}/>

  let admins = [];
  let owners = [];

  let addOwners = null;
  let addOwnersButton = null;
  if (isOwner){
    addOwnersButton = <Button value="+ Add Owner" callback={()=>{
      setAddOwners(true);
    }} />
  }
  

  if (shouldAddOwners){ 
    addOwners = <NewUser open={setAddOwners} driveId={driveId} type="Add Owner" setDriveUsers={setDriveUsers}/>
    addOwnersButton = null;
  }
  let addAdmins = null;
  let addAdminsButton = <Button value="+ Add Administrator" callback={()=>{
    setAddAdmins(true);
  }} />
  if (shouldAddAdmins){
    addAdmins = <NewUser open={setAddAdmins} driveId={driveId} type="Add Admin" setDriveUsers={setDriveUsers}/>
    addAdminsButton = null;
  }



  

  for (let owner of driveUsers.contents.owners){
    let isSelected = false;
    if (owner.userId === selectedUserId){
      isSelected = true;
    }
    owners.push(<User 
      key={`User${owner.userId}`} 
      isSelected={isSelected}
      onClick={setSelectedUserId}
      userId={owner.userId} 
      driveId={driveId} 
      email={owner.email} 
      isUser={owner.isUser} 
      screenName={owner.screenName}
      setDriveUsers={setDriveUsers}
      userRole="owner"
      isOwner={isOwner}
      numOwners={driveUsers.contents.owners.length}
      />)
  }
  for (let admin of driveUsers.contents.admins){
    let isSelected = false;
    if (admin.userId === selectedUserId){
      isSelected = true;
    }
    
    admins.push(<User 
      key={`User${admin.userId}`} 
      isSelected={isSelected}
      onClick={setSelectedUserId}
      userId={admin.userId} 
      driveId={driveId} 
      email={admin.email} 
      isUser={admin.isUser} 
      screenName={admin.screenName}
      setDriveUsers={setDriveUsers}
      userRole="admin"
      isOwner={isOwner}
      />)

  }
  let deleteCourseButton = null;
  if (isOwner){
    deleteCourseButton = <>
    <Button value="Delete Course" callback={()=>{
    // alert("Delete Drive")
    setDrivesInfo({
      color:props.color,
      label:driveLabel,
      image:props.image,
      newDriveId:props.driveId,
      type:"delete drive"
    })
  }} />
  <br />
  <br />
    </>
  }

  return <>
  <h2>{dIcon} {panelDriveLabel}</h2>
  <label>Course Name<input type="text" 
  value={driveLabel} 
  onChange={(e)=>setDriveLabel(e.target.value)} 
  onKeyDown={(e)=>{
    if (e.keyCode === 13){
      setPanelDriveLabel(driveLabel)
      setDrivesInfo({
        color:props.color,
        label:driveLabel,
        image:props.image,
        newDriveId:props.driveId,
        type:"update drive label",
      })
    }
  }}
  onBlur={()=>{
    setPanelDriveLabel(driveLabel)
    setDrivesInfo({
      color:props.color,
      label:driveLabel,
      image:props.image,
      newDriveId:props.driveId,
      type:"update drive label",
    })
  }}/></label>
  <br />
  <br />
  <DoenetDriveCardMenu
  key={`colorMenu${props.driveId}`}
  colors={driveColors} 
  initialValue={props.color}
  callback={(color)=>{
        setDrivesInfo({
          color,
          label:driveLabel,
          image:props.image,
          newDriveId:props.driveId,
          type:"update drive color"
        })
  }}
  />
  <br />
  <br />
  {deleteCourseButton}
  <h3>Owners</h3>
  {owners}
  {addOwners}
  {addOwnersButton}
  <h3>Admins</h3>
  {admins}
  {addAdmins}
  {addAdminsButton}

  </>
}

const FolderInfoPanel = function(props){
  const itemInfo = props.itemInfo;

  const setFolder = useSetRecoilState(folderDictionarySelector({driveId:itemInfo.driveId,folderId:itemInfo.parentFolderId}))
  const { deleteItem, onDeleteItemError } = useDeleteItem();
  const { renameItem, onRenameItemError } = useRenameItem();
  const [addToast, ToastType] = useToast();

  const [label,setLabel] = useState(itemInfo.label);

  let fIcon = <FontAwesomeIcon icon={faFolder}/>
  
  const renameItemCallback = (newLabel) => {
    const result = renameItem({
      driveIdFolderId: {driveId:itemInfo.driveId, folderId:itemInfo.parentFolderId},
      itemId: itemInfo.itemId,
      itemType: itemInfo.itemType,
      newLabel: newLabel
    });
    result.then((resp)=>{
      if (resp.data.success){
        addToast(`Renamed item to '${newLabel}'`, ToastType.SUCCESS);
      }else{
        onRenameItemError({errorMessage: resp.data.message});
      }
    }).catch((e)=>{
      onRenameItemError({errorMessage: e.message});
    })
  }
  
  return <>
  <h2>{fIcon} {itemInfo.label}</h2>

  <label>Folder Label<input type="text" 
  value={label} 
  onChange={(e)=>setLabel(e.target.value)} 
  onKeyDown={(e)=>{
    if (e.key === "Enter"){
      renameItemCallback(label);
    }
  }}
  onBlur={()=>{
    renameItemCallback(label);
  }}/></label>
  <br />
  <br />
  <Button value="Delete Folder" callback={()=>{
    const result = deleteItem({
      driveIdFolderId: {driveId:itemInfo.driveId, folderId:itemInfo.parentFolderId},
      itemId:itemInfo.itemId,
      driveInstanceId:itemInfo.driveInstanceId
    });
    result.then((resp)=>{
      if (resp.data.success){
        addToast(`Deleted item '${itemInfo?.label}'`, ToastType.SUCCESS);
      }else{
        onDeleteItemError({errorMessage: resp.data.message});
      }
    }).catch((e)=>{
      onDeleteItemError({errorMessage: e.message});
    })
  }} />
  </>
}

const DoenetMLInfoPanel = function(props){
  const itemInfo = props.itemInfo;

  const setFolder = useSetRecoilState(folderDictionarySelector({driveId:itemInfo.driveId,folderId:itemInfo.parentFolderId}))
  const { deleteItem, onDeleteItemError } = useDeleteItem();
  const [addToast, ToastType] = useToast();
  const { renameItem, onRenameItemError } = useRenameItem();

  const [label,setLabel] = useState(itemInfo.label);

  const { openOverlay } = useToolControlHelper();

  let dIcon = <FontAwesomeIcon icon={faCode}/>

  const renameItemCallback = (newLabel) => {
    const result = renameItem({
      driveIdFolderId: {driveId: itemInfo.driveId, folderId: itemInfo.parentFolderId},
      itemId: itemInfo.itemId,
      itemType: itemInfo.itemType,
      newLabel: newLabel
    });
    result.then((resp)=>{
      if (resp.data.success){
        addToast(`Renamed item to '${newLabel}'`, ToastType.SUCCESS);
      }else{
        onRenameItemError({errorMessage: resp.data.message});
      }
    }).catch((e)=>{
      onRenameItemError({errorMessage: e.message});
    })
  }
  
  return <>
  <h2>{dIcon} {itemInfo.label}</h2>

  <label>DoenetML Label<input type="text" 
  value={label} 
  onChange={(e)=>setLabel(e.target.value)} 
  onKeyDown={(e)=>{

    if (e.key === "Enter"){
      renameItemCallback(label);
    }
  }}
  onBlur={()=>{
    renameItemCallback(label);
  }}/></label>
  <br />
  <br />
  <Button value="Edit DoenetML" callback={()=>{
    openOverlay({type:"editor",branchId:itemInfo.branchId,title:itemInfo.label})
    // open("editor", itemInfo.branchId, itemInfo.label);
  }} />
  <br />
  <br />
  <Button value="Delete DoenetML" callback={()=>{
    const result = deleteItem({
      driveIdFolderId: {driveId:itemInfo.driveId, folderId:itemInfo.parentFolderId},
      itemId:itemInfo.itemId,
      driveInstanceId:itemInfo.driveInstanceId
    });
    result.then((resp)=>{
      if (resp.data.success){
        addToast(`Deleted item '${itemInfo?.label}'`, ToastType.SUCCESS);
      }else{
        onDeleteItemError({errorMessage: resp.data.message});
      }
    }).catch((e)=>{
      onDeleteItemError({errorMessage: e.message});
    })
  }} />
  </>
}

const ItemInfo = function (){
  // console.log("=== 🧐 Item Info")
  //Temp: Delete Soon

  const infoLoad = useRecoilValueLoadable(selectedInformation);
  const driveSelections = useRecoilValue(selectedDriveInformation);

    if (infoLoad.state === "loading"){ return null;}
    if (infoLoad.state === "hasError"){ 
      console.error(infoLoad.contents)
      return null;}

  
   
      let itemInfo = infoLoad?.contents?.itemInfo;

    if (infoLoad.contents?.number > 1){
      // let itemIds = [];
      // for (let itemObj of infoLoad.contents?.itemObjs){
      //   let key = `itemId${itemObj.itemId}`;
      //   itemIds.push(<div key={key}>{itemObj.itemId}</div>)
      // }
      return <>
      <h1>{infoLoad.contents.number} Items Selected</h1>
      {/* {itemIds} */}
      </>
    }else if (driveSelections.length > 1){
      return  <h1>{driveSelections.length} Drives Selected</h1>

    }else if (infoLoad.contents?.number < 1 && driveSelections.length < 1){
      if (!itemInfo) return <h3>No Items Selected</h3>;

    }else if (driveSelections.length === 1){
      const dInfo = driveSelections[0];

      return <DriveInfoPanel 
      key={`DriveInfoPanel${dInfo.driveId}`}
      label={dInfo.label} 
      color={dInfo.color}
      image={dInfo.image}
      driveId={dInfo.driveId} 
      />

    }else if (infoLoad.contents?.number === 1){
      if (itemInfo?.itemType === "DoenetML"){
        return <DoenetMLInfoPanel
        key={`DoenetMLInfoPanel${itemInfo.itemId}`}
        itemInfo={itemInfo}
        />
      }else if (itemInfo?.itemType === "Folder"){
        return <FolderInfoPanel
        key={`FolderInfoPanel${itemInfo.itemId}`}
        itemInfo={itemInfo}
        />
      }
   
    }
  
}

function AddCourseDriveButton(props){
  const history = useHistory();
  const [addToast, ToastType] = useToast();

  const createNewDrive = useRecoilCallback(({set})=> 
  async ({label,newDriveId,newCourseId,image,color})=>{
    let newDrive = {
      courseId:newCourseId,
      driveId:newDriveId,
      isShared:"0",
      label,
      type: "course",
      image,
      color,
      subType:"Administrator"
    }
    const payload = { params:{
      driveId:newDriveId,
      courseId:newCourseId,
      label,
      type:"new course drive",
      image,
      color,
    } }
    const result = axios.get("/api/addDrive.php", payload)

    result.then((resp) => {
      if (resp.data.success){
        set(fetchDrivesQuery,(oldDrivesInfo)=>{
          let newDrivesInfo = {...oldDrivesInfo}
          newDrivesInfo.driveIdsAndLabels = [newDrive,...oldDrivesInfo.driveIdsAndLabels]
          return newDrivesInfo
        })
      }
    })
    return result;
  });

  const deleteNewDrive = useRecoilCallback(({snapshot,set})=> 
  async (newDriveId)=>{
    console.log(">>>deleting newDriveId",newDriveId)
    //Filter out drive which was just added
    set(fetchDrivesQuery,(oldDrivesInfo)=>{
      //Could just unshift the first drive but that could break
      //this is less brittle
      let newDrivesInfo = {...oldDrivesInfo}
      let newDriveIdsAndLabels = [];
      for (let driveAndLabel of oldDrivesInfo.driveIdsAndLabels){
        if (driveAndLabel.driveId !== newDriveId){
          newDriveIdsAndLabels.push(driveAndLabel);
        }
      }
      newDrivesInfo.driveIdsAndLabels = newDriveIdsAndLabels;
      return newDrivesInfo
    })

  });


  function onError({errorMessage}){
    addToast(`Course not created. ${errorMessage}`, ToastType.ERROR);
  }

  return <Button value="Create a New Course" callback={()=>{
    let driveId = null;
    let newDriveId = nanoid();
    let newCourseId = nanoid();
    let label = "Untitled";
    let image = driveImages[Math.floor(Math.random() * driveImages.length)];
    let color = driveColors[Math.floor(Math.random() * driveColors.length)];
    const result = createNewDrive({label,driveId,newDriveId,newCourseId,image,color});
    result.then((resp)=>{
      if (resp.data.success){
        addToast(`Created a new course named '${label}'`, ToastType.SUCCESS);
      }else{
        onError({errorMessage: resp.data.message});
      }
    }).catch((e)=>{
      onError({errorMessage: e.message});
    })
    let urlParamsObj = Object.fromEntries(new URLSearchParams(props.route.location.search));
    let newParams = {...urlParamsObj} 
    newParams['path'] = `:::`
    history.push('?'+encodeParams(newParams))

  }}/>
}

function AddMenuPanel(props){
  let path = ":";
  if (props?.route?.location?.search){
      path = Object.fromEntries(new URLSearchParams(props.route.location.search))?.path;
  }
  let [driveId,folderId] = path.split(":");
  const [_, setFolderInfo] = useRecoilStateLoadable(folderDictionarySelector({driveId, folderId}))
  const { addItem, onAddItemError } = useAddItem();
  const [addToast, ToastType] = useToast();

  let addDrives = <>
   <Suspense fallback={<p>Failed to make add course drive button</p>} >
     <AddCourseDriveButton route={props.route} />
   </Suspense>
   </>

  if (driveId === ""){ return <>{addDrives}</>; }


  return <>
  <h3>Course</h3>
   {addDrives}
  <h3>Folder</h3>
  <Button value="Add Folder" callback={()=>{
    const result = addItem({
      driveIdFolderId: {driveId: driveId, folderId: folderId},
      label: "Untitled",
      itemType: "Folder"
    });
    result.then(resp => {
      if (resp.data.success){
        addToast(`Add new item 'Untitled'`, ToastType.SUCCESS);
      }else{
        onAddItemError({errorMessage: resp.data.message});
      }
    }).catch( e => {
      onAddItemError({errorMessage: e.message});
    })
  }
  } />

  <h3>DoenetML</h3>
  <Button value="Add DoenetML" callback={()=>{
    const result = addItem({
      driveIdFolderId: {driveId: driveId, folderId: folderId},
      label:"Untitled",
      itemType:"DoenetML"
    });
    result.then(resp => {
      if (resp.data.success){
        addToast(`Add new item 'Untitled'`, ToastType.SUCCESS);
      }else{
        onAddItemError({errorMessage: resp.data.message});
      }
    }).catch( e => {
      onAddItemError({errorMessage: e.message});
    })
  }
  } />
 
  {/* <h3>URL</h3>
  <div>
    <label>Label <input size="10" type="text" onChange={(e)=>setURLLabel(e.target.value)} value={URLLabel} /></label>
  </div>
  <div>
    <label>URL <input size="10" type="text" onChange={(e)=>setURLLink(e.target.value)} value={URLLink}/></label>
  <Button callback={()=>{
    setFolderInfo({instructionType:"addItem",
    label:URLLabel === "" ? "Untitled" : URLLabel,
    url:URLLink,
    itemType:"url"
    })
    setURLLink("");
  }} value="Add" />

  </div> */}

  </>
}

function AutoSelect(props){
  const { activateMenuPanel } = useToolControlHelper();

  const infoLoad = useRecoilValueLoadable(selectedInformation);

  if (infoLoad?.contents?.number > 0){
    activateMenuPanel(0);
  }else{
    activateMenuPanel(1);
  }
  return null;
}

export default function Library(props) {
  // console.log("=== 📚 Doenet Library Tool",props);  

  const { openOverlay, activateMenuPanel } = useToolControlHelper();

  // const setSupportVisiblity = useSetRecoilState(supportVisible);
  const clearSelections = useSetRecoilState(clearDriveAndItemSelections);
  const setDrivecardSelection = useSetRecoilState(drivecardSelectedNodesAtom)
  let routePathDriveId = "";
  let urlParamsObj = Object.fromEntries(
    new URLSearchParams(props.route.location.search)
  );
  if (urlParamsObj?.path !== undefined) {
    [
      routePathDriveId
    ] = urlParamsObj.path.split(":");
  }

  //Select +Add menuPanel if no drives selected on startup
  useEffect(()=>{
    if (routePathDriveId === ""){
      activateMenuPanel(1)
    }
  },[]);
  
  const history = useHistory();

  const profile = useContext(ProfileContext)

  if (profile.signedIn === "0"){
    return (<>
     <GlobalFont/>
    <Tool>

      <headerPanel title="Library">
      </headerPanel>

      <mainPanel>
        <div style={{border:"1px solid grey",borderRadius:"20px",margin:"auto",marginTop:"10%",padding:"10px",width:"50%"}}>
          <div style={{textAlign:"center",alignItems:"center",marginBottom:"20px"}}>
          <h2>You are not signed in</h2>
          <h2>Library currently requires sign in for use</h2> 
          <button style={{background:"#1a5a99",borderRadius:"5px"}}><a href='/signin' style={{color:"white",textDecoration:"none"}}>Sign in with this link</a></button>
          </div>
          </div>
      </mainPanel>
    
     
    </Tool>
    </>
    )
  }


  function useOutsideDriveSelector() {
    let newParams = {};
    newParams["path"] = `:::`;
    history.push("?" + encodeParams(newParams));
  }

  function cleardrivecardSelection(){
    setDrivecardSelection([]);
    // let newParams = {};
    // newParams["path"] = `:::`;
    // history.push("?" + encodeParams(newParams));
  }

 
  // Breadcrumb container
  let breadcrumbContainer = null;
  if (routePathDriveId) {
    breadcrumbContainer = <BreadcrumbContainer />;
  }

  const driveCardSelection = ({item}) => {
    let newParams = {};
    newParams["path"] = `${item.driveId}:${item.driveId}:${item.driveId}:Drive`;
    history.push("?" + encodeParams(newParams));
  }

  return (
    <>
    <GlobalFont/>
    <Tool>
      <navPanel isInitOpen>
      <div style={{height:"100vh"}} onClick={useOutsideDriveSelector}>
         <div  style={{paddingBottom:"40px"}}>
        <Drive types={['content','course']}  foldersOnly={true} />
      </div>
      </div>
      </navPanel>

      <headerPanel title="Library">
      </headerPanel>

      <mainPanel > 
      <AutoSelect />
      {breadcrumbContainer}
        <div 
        onClick={()=>{
          clearSelections()
        }}
        className={routePathDriveId ? 'mainPanelStyle' : ''}
        >
          <Container>
          <Drive types={['content','course']}  urlClickBehavior="select" 
        doenetMLDoubleClickCallback={(info)=>{
          openOverlay({type:"editor",branchId: info.item.branchId,title: info.item.label});
          }}/>
          </Container>
        

        </div>
       
        <div 
        onClick={
          cleardrivecardSelection
        }
        tabIndex={0}
        className={routePathDriveId ? '' : 'mainPanelStyle' }
        >
       <DriveCards
       types={['course']}
       subTypes={['Administrator']}
       routePathDriveId={routePathDriveId}
       driveDoubleClickCallback={({item})=>{driveCardSelection({item})}}
       />
        </div>
        
          
        </mainPanel>
      <supportPanel>
      <Container>

      <Drive types={['content','course']}  urlClickBehavior="select" />
      </Container>
      </supportPanel>

      <menuPanel title="Selected" isInitOpen>
        <ItemInfo  />
      </menuPanel>
      <menuPanel title="+ Add Items" isInitOpen>
       <AddMenuPanel route={props.route} />
      </menuPanel>

     

     
    </Tool>
    </>
  );
}
