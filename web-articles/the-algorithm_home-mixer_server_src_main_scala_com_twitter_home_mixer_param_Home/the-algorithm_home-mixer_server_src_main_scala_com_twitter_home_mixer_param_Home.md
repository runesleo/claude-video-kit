# the-algorithm/home-mixer/server/src/main/scala/com/twitter/home_mixer/param/HomeGlobalParams.scala at main · twitter/the

> 原文链接: https://github.com/twitter/the-algorithm/blob/main/home-mixer/server/src/main/scala/com/twitter/home_mixer/param/HomeGlobalParams.scala

---
[Open in github.dev](https://github.dev/) [Open in a new github.dev tab](https://github.dev/) [Open in codespace](/codespaces/new/twitter/the-algorithm/tree/main?resume=1) [](/twitter/the-algorithm)

## FilesExpand file tree

 main

/

# HomeGlobalParams.scala

Copy path

t

BlameMore file actions

## Latest commit

![author](images/img_001.png)

twitter-team

[update for-you recommendations code](/twitter/the-algorithm/commit/c54bec0d4e029fe34926ef3258a86ccacc0d0182)

Sep 4, 2025

[c54bec0](/twitter/the-algorithm/commit/c54bec0d4e029fe34926ef3258a86ccacc0d0182) · Sep 4, 2025

## History

[History](/twitter/the-algorithm/commits/main/home-mixer/server/src/main/scala/com/twitter/home_mixer/param/HomeGlobalParams.scala)

Open commit details

[](/twitter/the-algorithm/commits/main/home-mixer/server/src/main/scala/com/twitter/home_mixer/param/HomeGlobalParams.scala)History

1479 lines (1261 loc) · 42.8 KB

 main

/

# HomeGlobalParams.scala

Top

## File metadata and controls

-   Code

-   Blame


1479 lines (1261 loc) · 42.8 KB

Add to spaceAsk Copilot about this file

[Raw](https://github.com/twitter/the-algorithm/raw/refs/heads/main/home-mixer/server/src/main/scala/com/twitter/home_mixer/param/HomeGlobalParams.scala)

Copy raw file

Download raw file

[](https://github.dev/)[](https://github.dev/)

[](/twitter/the-algorithm/edit/main/home-mixer/server/src/main/scala/com/twitter/home_mixer/param/HomeGlobalParams.scala)Fork this repository and edit the file

More edit options

Close symbols panel

Edit and raw actions

package com.twitter.home\_mixer.param import com.twitter.conversions.DurationOps.\_ import com.twitter.home\_mixer.param.decider.DeciderKey import com.twitter.timelines.configapi.DurationConversion import com.twitter.timelines.configapi.FSBoundedParam import com.twitter.timelines.configapi.FSEnumParam import com.twitter.timelines.configapi.FSParam import com.twitter.timelines.configapi.HasDurationConversion import com.twitter.timelines.configapi.decider.BooleanDeciderParam import com.twitter.timelines.configapi.decider.DeciderBoundedParam import com.twitter.util.Duration /\*\* \* Instantiate Params that do not relate to a specific product. \* \* @see \[\[com.twitter.product\_mixer.core.product.ProductParamConfig.supportedClientFSName\]\] \*/ object HomeGlobalParams { /\*\* \* This param is used to disable ads injection for timelines served by home-mixer. \* It is currently used to maintain user-role based no-ads lists for automation accounts, \* and should NOT be used for other purposes. \*/ object AdsDisableInjectionBasedOnUserRoleParam extends FSParam( name = "home\_mixer\_ads\_disable\_injection\_based\_on\_user\_role", default = false ) object EnableTweetEntityServiceMigrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_tweet\_entity\_service\_migration", default = false ) object EnableTweetEntityServiceVisibilityMigrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_tweet\_entity\_service\_visibility\_migration", default = false ) object EnableSendScoresToClient extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_send\_scores\_to\_client", default = false ) object EnableDebugString extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_debug\_string", default = false ) object EnablePersistenceDebug extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_persistence\_debug", default = false ) object MaxNumberReplaceInstructionsParam extends FSBoundedParam\[Int\]( name = "home\_mixer\_max\_number\_replace\_instructions", default = 10, min = 1, max = 20 ) object TimelinesPersistenceStoreMaxEntriesPerClient extends FSBoundedParam\[Int\]( name = "home\_mixer\_timelines\_persistence\_store\_max\_entries\_per\_client", default = 1800, min = 500, max = 5000 ) object EnableNewTweetsPillAvatarsParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_new\_tweets\_pill\_avatars", default = true ) object EnableSocialContextParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_social\_context", default = false ) object EnableCommunitiesContextParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_communities\_context", default = true ) object EnableAdvertiserBrandSafetySettingsFeatureHydratorParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_advertiser\_brand\_safety\_settings\_feature\_hydrator", default = true ) object EnableBasketballContextFeatureHydratorParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_basketball\_context\_feature\_hydrator", default = false ) object EnablePostContextFeatureHydratorParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_post\_context\_feature\_hydrator", default = false ) object BasketballTeamAccountIdsParam extends FSParam\[Set\[Long\]\]( name = "home\_mixer\_basketball\_team\_account\_ids", default = Set() ) object EnableSSPAdsBrandSafetySettingsFeatureHydratorParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_ssp\_ads\_brand\_safety\_settings\_feature\_hydrator", default = true ) object ExcludeServedTweetIdsNumberParam extends FSBoundedParam\[Int\]( name = "home\_mixer\_exclude\_served\_tweet\_ids\_number", default = 100, min = 0, max = 100 ) object ExcludeServedTweetIdsDurationParam extends FSBoundedParam\[Duration\]( "home\_mixer\_exclude\_served\_tweet\_ids\_in\_minutes", default = 10.minutes, min = 1.minute, max = 60.minutes) with HasDurationConversion { override val durationConversion: DurationConversion = DurationConversion.FromMinutes } object ExcludeServedAuthorIdsDurationParam extends FSBoundedParam\[Duration\]( "home\_mixer\_exclude\_served\_author\_ids\_in\_minutes", default = 60.minutes, min = 1.minute, max = 60.minutes) with HasDurationConversion { override val durationConversion: DurationConversion = DurationConversion.FromMinutes } object EnableServedFilterAllRequests extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_served\_filter\_all\_requests", default = false ) object EnableScribeServedCandidatesParam extends FSParam\[Boolean\]( name = "home\_mixer\_served\_tweets\_enable\_scribing", default = false ) object EnableServedCandidateFeatureKeysKafkaPublishingParam extends BooleanDeciderParam( decider = DeciderKey.EnableServedCandidateFeatureKeysKafkaPublishing) object RateLimitTestIdsParam extends FSParam\[Set\[Long\]\]( name = "home\_mixer\_rate\_limit\_test\_ids", default = Set.empty ) object IsSelectedByHeavyRankerCountParam extends FSBoundedParam\[Int\]( name = "home\_mixer\_is\_selected\_by\_heavy\_ranker\_count", default = 100, min = 0, max = 2000 ) object EnableAdditionalChildFeedbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_additional\_child\_feedback", default = false ) object EnableBlockMuteReportChildFeedbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_block\_mute\_report\_child\_feedback", default = false ) object ListMandarinTweetsParams { object ListMandarinTweetsEnable extends FSParam\[Boolean\]( name = "home\_mixer\_mandarin\_list\_tweets\_enabled", default = false ) object ListMandarinTweetsLists extends FSParam\[Seq\[Long\]\]( name = "home\_mixer\_mandarin\_tweets\_lists", default = Seq.empty ) } object FeatureHydration { object EnableLargeEmbeddingsFeatureHydrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_large\_embeddings", default = false ) object EnableSimClustersSimilarityFeaturesDeciderParam extends BooleanDeciderParam( decider = DeciderKey.EnableSimClustersSimilarityFeatureHydration ) object EnableOnPremRealGraphQueryFeatures extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_on\_prem\_real\_graph\_query\_features", default = false ) object EnableRealGraphQueryFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_real\_graph\_query\_features", default = false ) object EnableRealGraphViewerRelatedUsersFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_real\_graph\_viewer\_related\_users\_features", default = false ) object EnableSimclustersSparseTweetFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_simclusters\_sparse\_tweet\_features", default = false ) object EnableTwhinUserPositiveFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_user\_positive\_features", default = false ) object EnableTwhinVideoFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_video\_features", default = false ) object EnableTwhinUserNegativeFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_user\_negative\_features", default = false ) object EnableTwhinVideoFeaturesOnlineParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_video\_online\_features", default = false ) object EnableTwhinRebuildUserEngagementFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_rebuild\_user\_engagement\_features", default = false ) object EnableTwhinRebuildUserPositiveFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_rebuild\_user\_positive\_features", default = false ) object EnableClipEmbeddingFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_clip\_embedding\_features", default = false ) object EnableClipEmbeddingMediaUnderstandingFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_clip\_embedding\_media\_understanding\_features", default = false ) object EnableUserHistoryTransformerJointBlueEmbeddingFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_user\_history\_transformer\_joint\_blue\_embedding\_features", default = false ) object EnableTweetLanguageFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweet\_language\_features", default = false ) object EnableTwhinTweetFeaturesOnlineParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_tweet\_online\_features", default = false ) object EnableTwhinRebuildTweetFeaturesOnlineParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_twhin\_rebuild\_tweet\_online\_features", default = false ) object EnableTransformerPostEmbeddingJointBlueFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_transformer\_post\_embedding\_features\_joint\_blue", default = false ) object EnableTweetypieContentFeaturesDeciderParam extends BooleanDeciderParam( decider = DeciderKey.EnableTweetypieContentFeatures ) object EnableTweetypieContentFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweetypie\_content\_features", default = true ) object EnableTweetypieContentMediaEntityFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweetypie\_content\_media\_entity\_features", default = true ) object EnableUserFavAvgTextEmbeddingsQueryFeatureParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_user\_fav\_avg\_text\_embeddings\_query\_feature", default = false ) object EnableTweetTextTokensEmbeddingFeatureScribingParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweet\_text\_tokens\_embedding\_feature\_scribing", default = false ) object EnableTweetVideoAggregatedWatchTimeFeatureScribingParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweet\_video\_aggregated\_watch\_time", default = false ) object EnableImmersiveClientActionsQueryFeatureHydrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_immersive\_client\_actions", default = false ) object EnableImmersiveClientActionsClipEmbeddingQueryFeatureHydrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_immersive\_client\_actions\_clip\_embedding", default = false ) object EnableGrokVideoMetadataFeatureHydrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_grok\_video\_metadata", default = false ) object EnableDedupClusterIdFeatureHydrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_dedup\_cluster\_id", default = false ) object EnableDedupClusterId88FeatureHydrationParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_dedup\_cluster\_id\_88", default = false ) object EnableGeoduckAuthorLocationHydatorParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_geoduck\_author\_location\_hydrator", default = false ) object EnableViewCountFeaturesParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_view\_count\_features", default = false ) object EnableVideoSummaryEmbeddingFeatureDeciderParam extends BooleanDeciderParam( decider = DeciderKey.EnableVideoSummaryEmbeddingHydration ) object EnableVideoClipEmbeddingFeatureHydrationDeciderParam extends BooleanDeciderParam( decider = DeciderKey.EnableVideoClipEmbeddingHydration ) object EnableScoredVideoTweetsUserHistoryEventsQueryFeatureHydrationDeciderParam extends BooleanDeciderParam( decider = DeciderKey.EnableScoredVideoTweetsUserHistoryEventsQueryFeatureHydrationDeciderParam ) object EnableVideoClipEmbeddingMediaUnderstandingFeatureHydrationDeciderParam extends BooleanDeciderParam( decider = DeciderKey.EnableVideoClipEmbeddingMediaUnderstandingHydration ) } object Scoring { object AuthorListForDataCollectionParam extends FSParam\[Set\[Long\]\]( name = "home\_mixer\_author\_list\_for\_data\_collection", default = Set.empty\[Long\] ) object ModelNameParam extends FSParam\[String\]( name = "home\_mixer\_model\_name", default = "" ) object ImpressedMediaClusterBasedRescoringParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_impressed\_media\_cluster\_based\_rescoring", default = 0.0, min = 0.0, max = 0.2 ) object ImpressedImageClusterBasedRescoringParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_impressed\_image\_cluster\_based\_rescoring", default = 0.0, min = 0.0, max = 1.0 ) object ModelIdParam extends FSParam\[String\]( name = "home\_mixer\_model\_id", default = "Home" ) object ProdModelIdParam extends FSParam\[String\]( name = "home\_mixer\_model\_prod\_model\_id", default = "Home" ) object UseRealtimeNaviClusterParam extends FSParam\[Boolean\]( name = "home\_mixer\_model\_use\_realtime\_navi\_cluster", default = false ) object UseGPUNaviClusterParam extends FSParam\[Boolean\]( name = "home\_mixer\_model\_use\_gpu\_navi\_cluster", default = false ) object UseSecondaryNaviClusterParam extends BooleanDeciderParam(decider = DeciderKey.EnableSecondaryNaviRecapCluster) object UseGPUNaviClusterTestUsersParam extends BooleanDeciderParam(decider = DeciderKey.EnableGPUNaviRecapClusterTestUsers) object UseVideoNaviClusterParam extends FSParam\[Boolean\]("home\_mixer\_model\_use\_video\_navi\_cluster", false) object NaviGPUBatchSizeParam extends DeciderBoundedParam\[Double\]( decider = DeciderKey.NaviGPUClusterRequestBatchSize, default = 1800.0, min = 0.0, max = 10000.0 ) object AddNoiseInWeightsPerLabel extends FSParam\[Boolean\]( name = "home\_mixer\_add\_noise\_in\_weights\_per\_label", default = false ) object EnableDailyFrozenNoisyWeights extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_daily\_frozen\_weights", default = false ) object NoisyWeightAlphaParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_noisy\_weight\_alpha\_param", default = 2, min = 0.0, max = 10.0 ) object NoisyWeightBetaParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_noisy\_weight\_beta\_param", default = 2, min = 0.0, max = 10.0 ) object NegativeScoreConstantFilterThresholdParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_negative\_score\_constant\_filter\_threshold", default = 1e-3, min = 0, max = 1 ) object NegativeScoreNormFilterThresholdParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_negative\_score\_norm\_filter\_threshold", default = 0.15, min = 0, max = 1 ) object RequestNormalizedScoresParam extends FSParam\[Boolean\]( name = "home\_mixer\_request\_normalized\_scores", default = false ) object NormalizedNegativeHead extends FSParam\[Boolean\]( name = "home\_mixer\_normalized\_negative\_head", default = false ) object UseWeightForNegHeadParam extends FSParam\[Boolean\]( name = "home\_mixer\_use\_weight\_for\_neg\_head", default = false ) object ConstantNegativeHead extends FSParam\[Boolean\]( name = "home\_mixer\_constant\_negative\_head", default = false ) object EnableNoNegHeuristicParam extends FSParam\[Boolean\]( name = "home\_mixer\_no\_neg\_heuristic", default = false ) object EnableNegSectionRankingParam extends FSParam\[Boolean\]( name = "home\_mixer\_neg\_section\_ranking", default = false ) object RequestRankDecayFactorParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_request\_rank\_decay\_factor", default = 0.95, min = 0, max = 1 ) object ScoreThresholdForVQVParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_score\_threshold\_for\_vqv", default = 0.0, min = 0.0, max = 1.0 ) object ScoreThresholdForDwellParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_score\_threshold\_for\_dwell", default = 0.0, min = 0.0, max = 1.0 ) object EnableBinarySchemeForVQVParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_binary\_scheme\_for\_vqv", default = false ) object BinarySchemeConstantForVQVParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_constant\_binary\_scheme\_for\_vqv", default = 0.0, min = 0.0, max = 1.0 ) object EnableBinarySchemeForDwellParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_binary\_scheme\_for\_dwell", default = false ) object EnableDwellOrVQVParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_dwell\_or\_video\_watch\_time", default = false ) object TwhinDiversityRescoringParam extends FSParam\[Boolean\]( name = "home\_mixer\_twhin\_diversity\_rescoring", default = false ) object CategoryDiversityRescoringParam extends FSParam\[Boolean\]( name = "home\_mixer\_category\_diversity\_rescoring", default = false ) object ModelBiases { object VideoQualityViewParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_bias\_video\_quality\_viewed", default = 0.0, min = 0.0, max = 100.0 ) object VideoQualityViewImmersiveParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_bias\_video\_quality\_viewed\_immersive", default = 0.0, min = 0.0, max = 100.0 ) object VideoQualityWatchParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_bias\_video\_quality\_watched", default = 0.0, min = 0.0, max = 100.0 ) } object ModelDebiases { object FavParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_fav", default = 0.0, min = -10000.0, max = 10000.0 ) object RetweetParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_retweet", default = 0.0, min = -10000.0, max = 10000.0 ) object ReplyParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_reply", default = 0.0, min = -10000.0, max = 10000.0 ) object DwellParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_dwell", default = 0.0, min = -10000.0, max = 10000.0 ) object GoodProfileClickParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_good\_profile\_click", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoWatchTimeMsParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_video\_watch\_time\_ms", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoQualityViewParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_video\_quality\_viewed", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoQualityViewImmersiveParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_video\_quality\_viewed\_immersive", default = 0.0, min = -10000.0, max = 10000.0 ) object ReplyEngagedByAuthorParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_reply\_engaged\_by\_author", default = 0.0, min = -10000.0, max = 10000.0 ) object GoodClickV1Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_good\_click\_v1", default = 0.0, min = -10000.0, max = 10000.0 ) object GoodClickV2Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_good\_click\_v2", default = 0.0, min = -10000.0, max = 10000.0 ) object BookmarkParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_bookmark", default = 0.0, min = -10000.0, max = 10000.0 ) object ShareParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_share", default = 0.0, min = -10000.0, max = 10000.0 ) object NegativeFeedbackV2Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_negative\_feedback\_v2", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoQualityWatchParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_debias\_video\_quality\_watched", default = 0.0, min = -10000.0, max = 10000.0 ) } object ModelWeights { object FavParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_fav", default = 0.0, min = -10000.0, max = 10000.0 ) object RetweetParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_retweet", default = 0.0, min = -10000.0, max = 10000.0 ) object ReplyParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_reply", default = 0.0, min = -10000.0, max = 10000.0 ) object GoodProfileClickParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_good\_profile\_click", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoPlayback50Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_video\_playback50", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoQualityViewParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_video\_quality\_viewed", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoQualityViewImmersiveParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_video\_quality\_viewed\_immersive", default = 0.0, min = -10000.0, max = 10000.0 ) object ReplyEngagedByAuthorParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_reply\_engaged\_by\_author", default = 0.0, min = -10000.0, max = 10000.0 ) object GoodClickParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_good\_click", default = 0.0, min = -10000.0, max = 10000.0 ) object GoodClickV1Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_good\_click\_v1", default = 0.0, min = -10000.0, max = 10000.0 ) object GoodClickV2Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_good\_click\_v2", default = 0.0, min = -10000.0, max = 10000.0 ) object TweetDetailDwellParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_tweet\_detail\_dwell", default = 0.0, min = -10000.0, max = 10000.0 ) object ProfileDwelledParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_profile\_dwelled", default = 0.0, min = -10000.0, max = 10000.0 ) object BookmarkParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_bookmark", default = 0.0, min = -10000.0, max = 10000.0 ) object ShareParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_share", default = 0.0, min = -10000.0, max = 10000.0 ) object ShareMenuClickParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_share\_menu\_click", default = 0.0, min = -10000.0, max = 10000.0 ) object NegativeFeedbackV2Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_negative\_feedback\_v2", default = 0.0, min = -10000.0, max = 10000.0 ) object ReportParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_report", default = 0.0, min = -20000.0, max = 0.0 ) object WeakNegativeFeedbackParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_weak\_negative\_feedback", default = 0.0, min = -1000.0, max = 0.0 ) object StrongNegativeFeedbackParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_strong\_negative\_feedback", default = 0.0, min = -1000.0, max = 0.0 ) object DwellParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_dwell", default = 0.0, min = -10000.0, max = 10000.0 ) object OpenLinkParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_open\_link", default = 0.0, min = -10000.0, max = 10000.0 ) object ScreenshotParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_screenshot", default = 0.0, min = -10000.0, max = 10000.0 ) object VideoWatchTimeMsParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_video\_watch\_time\_ms", default = 0.0, min = -10000.0, max = 10000.0 ) // Categorical Dwell Params object Dwell0Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_dwell\_0", default = 0.0, min = 0.0, max = 1000.0 ) object Dwell1Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_dwell\_1", default = 0.0, min = 0.0, max = 1000.0 ) object Dwell2Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_dwell\_2", default = 0.0, min = 0.0, max = 1000.0 ) object Dwell3Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_dwell\_3", default = 0.0, min = 0.0, max = 1000.0 ) object Dwell4Param extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_dwell\_4", default = 0.0, min = 0.0, max = 1000.0 ) object VideoQualityWatchParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_model\_weight\_video\_quality\_watched", default = 0.0, min = -10000.0, max = 10000.0 ) } object UseProdInPhoenixParams { object EnableProdFavForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_fav\_for\_phoenix", default = false ) object EnableProdReplyForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_reply\_for\_phoenix", default = false ) object EnableProdShareForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_share\_for\_phoenix", default = false ) object EnableProdRetweetForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_retweet\_for\_phoenix", default = false ) object EnableProdVQVForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_vqv\_for\_phoenix", default = false ) object EnableProdDwellForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_dwell\_for\_phoenix", default = false ) object EnableProdNegForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_neg\_for\_phoenix", default = false ) object EnableProdProfileClickForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_profile\_click\_for\_phoenix", default = false ) object EnableProdGoodClickV1ForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_good\_click\_v1\_for\_phoenix", default = false ) object EnableProdGoodClickV2ForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_good\_click\_v2\_for\_phoenix", default = false ) object EnableProdOpenLinkForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_open\_link\_for\_phoenix", default = false ) object EnableProdScreenshotForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_screenshot\_for\_phoenix", default = false ) object EnableProdBookmarkForPhoenixParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_prod\_bookmark\_for\_phoenix", default = false ) } } object EnableTenSecondsLogicForVQV extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_ten\_seconds\_logic\_for\_vqv", default = true ) object EnableImmersiveVQV extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_immersive\_vqv", default = false ) object EnableLandingPage extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_landing\_page", default = false ) object EnableExploreSimclustersLandingPage extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_explore\_simclusters\_landing\_page", default = false ) object EnableTopicBasedRealTimeAggregateFeatureHydratorParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_topic\_based\_real\_time\_aggregate\_feature\_hydrator\_param", default = true ) object EnableTopicCountryBasedRealTimeAggregateFeatureHydratorParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_topic\_country\_based\_real\_time\_aggregate\_feature\_hydrator\_param", default = true ) object EnableTopicEdgeAggregateFeatureHydratorParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_topic\_edge\_aggregate\_feature\_hydrator\_param", default = true ) object FeedbackFatigueFilteringDurationParam extends FSBoundedParam\[Duration\]( name = "home\_mixer\_feedback\_fatigue\_filtering\_duration\_in\_days", default = 14.days, min = 0.days, max = 100.days ) with HasDurationConversion { override val durationConversion: DurationConversion = DurationConversion.FromDays } object EnableCommonFeaturesDataRecordCopyDuringPldrConversionParam extends BooleanDeciderParam( decider = DeciderKey.EnableCommonFeaturesDataRecordCopyDuringPldrConversion) object EnablePinnedTweetsCarouselParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_pinned\_tweets\_carousel", default = false ) object EnablePostFeedbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_post\_feedback", default = false ) object PostFeedbackThresholdParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_post\_feedback\_threshold", default = 0.0, min = 0.0, max = 1.0 ) object PostFeedbackPromptTitleParam extends FSParam\[String\]( name = "home\_mixer\_post\_feedback\_prompt\_title", default = "Are you interested in this post?" ) object PostFeedbackPromptPositiveParam extends FSParam\[String\]( name = "home\_mixer\_post\_feedback\_prompt\_positive", default = "Yes" ) object PostFeedbackPromptNegativeParam extends FSParam\[String\]( name = "home\_mixer\_post\_feedback\_prompt\_negative", default = "No" ) object PostFeedbackPromptNeutralParam extends FSParam\[String\]( name = "home\_mixer\_post\_feedback\_prompt\_neutral", default = "Not sure" ) object EnablePostFollowupParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_post\_followup", default = false ) object EnablePostDetailsNegativeFeedbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_post\_details\_negative\_feedback", default = false ) object PostFollowupThresholdParam extends FSBoundedParam\[Double\]( name = "home\_mixer\_post\_followup\_threshold", default = 0.0, min = 0.0, max = 1.0 ) object EnableSlopFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_slop\_filter", default = false ) object EnableNsfwFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_nsfw\_filter", default = false ) object EnableSoftNsfwFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_soft\_nsfw\_filter", default = false ) object EnableGrokSpamFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_grok\_spam\_filter", default = false ) object EnableGrokViolentFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_grok\_violent\_filter", default = false ) object EnableGrokGoreFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_grok\_gore\_filter", default = false ) object EnableMinVideoDurationFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_min\_video\_duration\_filter", default = false ) object EnableMaxVideoDurationFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_max\_video\_duration\_filter", default = false ) object EnableClusterBasedDedupFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_cluster\_based\_dedup\_filter", default = false ) object EnableCountryFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_country\_filter", default = false ) object EnableRegionFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_region\_filter", default = false ) object EnableHasMultipleMediaFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_has\_multiple\_media\_filter", default = false ) object EnableClusterBased88DedupFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_cluster\_based\_88\_dedup\_filter", default = false ) object EnableNoClusterFilter extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_no\_cluster\_filter", default = false ) object DedupHistoricalEventsTimeWindowParam extends FSBoundedParam\[Long\]( name = "home\_mixer\_dedup\_historical\_events\_time\_window", default = 43200000L, // 12 \* 60 \* 60 \* 1000 = 12hrs in milliseconds min = 0L, max = 604800000L // 7 days ) object MinVideoDurationThresholdParam extends FSBoundedParam\[Long\]( name = "home\_mixer\_min\_video\_duration\_threshold", default = 0L, // 0 second min = 0L, max = 604800000L // 7 days ) object MaxVideoDurationThresholdParam extends FSBoundedParam\[Long\]( name = "home\_mixer\_max\_video\_duration\_threshold", default = 604800000L, // 7 days min = 0L, max = 604800000L // 7 days ) object EnableSlopFilterLowSignalUsers extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_slop\_filter\_low\_signal\_users", default = false ) object EnableSlopFilterEligibleUserStateParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_slop\_filter\_eligible\_user\_state\_param", default = true ) object SlopMaxScore extends FSBoundedParam\[Double\]( name = "home\_mixer\_slop\_max\_score", default = 0.3, min = 0.0, max = 4.0 ) object SlopMinFollowers extends FSBoundedParam\[Int\]( name = "home\_mixer\_slop\_min\_followers", default = 100, min = 0, max = 10000000 ) object EnableGrokAnnotations extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_grok\_annotations", default = false ) object UserActionsMaxCount extends FSBoundedParam\[Int\]( name = "home\_mixer\_user\_actions\_max\_count", default = 522, min = 0, max = 10000 ) object EnableTweetRTAMhOnlyParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweet\_rta\_read\_from\_mh", default = false ) object EnableTweetRTAMhFallbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweet\_rta\_read\_fallback\_to\_mh", default = false ) object EnableTweetCountryRTAMhOnlyParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweet\_country\_rta\_read\_from\_mh", default = false ) object EnableTweetCountryRTAMhFallbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_tweet\_country\_rta\_read\_fallback\_to\_mh", default = false ) object EnableUserRTAMhOnlyParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_user\_rta\_read\_from\_mh", default = false ) object EnableUserRTAMhFallbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_user\_rta\_read\_fallback\_to\_mh", default = false ) object EnableUserAuthorRTAMhOnlyParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_user\_author\_rta\_read\_from\_mh", default = false ) object EnableUserAuthorRTAMhFallbackParam extends FSParam\[Boolean\]( name = "home\_mixer\_feature\_hydration\_enable\_user\_author\_rta\_read\_fallback\_to\_mh", default = false ) object MaxPostContextPostsPerRequest extends FSParam\[Int\]( name = "home\_mixer\_feature\_hydration\_max\_post\_context\_posts", default = 5 ) object MaxPostContextDuplicatesPerRequest extends FSParam\[Int\]( name = "home\_mixer\_feature\_hydration\_max\_post\_context\_duplicates", default = 2 ) object PhoenixCluster extends Enumeration { val Prod = Value val Experiment1 = Value val Experiment2 = Value val Experiment3 = Value val Experiment4 = Value val Experiment5 = Value val Experiment6 = Value val Experiment7 = Value val Experiment8 = Value } object PhoenixInferenceClusterParam extends FSEnumParam\[PhoenixCluster.type\]( name = "home\_mixer\_model\_phoenix\_inference\_cluster\_id", default = PhoenixCluster.Prod, enum = PhoenixCluster ) object PhoenixTimeoutInMsParam extends FSBoundedParam\[Int\]( name = "home\_mixer\_model\_phoenix\_timeout\_in\_ms", default = 500, min = 10, max = 10000 ) object EnablePhoenixScorerParam extends FSParam\[Boolean\]( name = "home\_mixer\_model\_enable\_phoenix\_scorer", default = false ) object EnableUserActionsShadowScribeParam extends FSParam\[Boolean\]( name = "home\_mixer\_enable\_user\_actions\_shadow\_scribe", default = false ) }

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

24

25

26

27

28

29

30

31

32

33

34

35

36

37

38

39

40

41

42

43

44

45

46

47

48

49

50

51

52

53

54

55

56

57

58

59

60

61

62

63

64

65

66

67

68

69

70

71

72

73

74

75

76

77

78

79

80

81

82

83

84

85

86

87

88

89

90

91

92

93

94

95

96

97

98

99

100

101

102

103

104

105

106

107

108

109

110

111

112

113

114

115

116

117

118

119

120

121

122

123

124

125

126

127

128

129

130

131

132

133

134

135

136

137

138

139

140

141

142

143

144

145

146

147

148

149

150

151

152

153

154

155

156

157

158

159

160

161

162

163

164

165

166

167

168

169

170

171

172

173

174

175

176

177

178

179

180

181

182

183

184

185

186

187

188

189

190

191

192

193

194

195

196

197

198

199

200

201

202

203

204

205

206

207

208

209

210

211

212

213

214

215

216

217

218

219

220

221

222

223

224

225

226

227

228

229

230

231

232

233

234

235

236

237

238

239

240

241

242

243

244

245

246

247

248

249

250

251

252

253

254

255

256

257

258

259

260

261

262

263

264

265

266

267

268

269

270

271

272

273

274

275

276

277

278

279

280

281

282

283

284

285

286

287

288

289

290

291

292

293

294

295

296

297

298

299

300

301

302

303

304

305

306

307

308

309

310

311

312

313

314

315

316

317

318

319

320

321

322

323

324

325

326

327

328

329

330

331

332

333

334

335

336

337

338

339

340

341

342

343

344

345

346

347

348

349

350

351

352

353

354

355

356

357

358

359

360

361

362

363

364

365

366

367

368

369

370

371

372

373

374

375

376

377

378

379

380

381

382

383

384

385

386

387

388

389

390

391

392

393

394

395

396

397

398

399

400

401

402

403

404

405

406

407

408

409

410

411

412

413

414

415

416

417

418

419

420

421

422

423

424

425

426

427

428

429

430

431

432

433

434

435

436

437

438

439

440

441

442

443

444

445

446

447

448

449

450

451

452

453

454

455

456

457

458

459

460

461

462

463

464

465

466

467

468

469

470

471

472

473

474

475

476

477

478

479

480

481

482

483

484

485

486

487

488

489

490

491

492

493

494

495

496

497

498

499

500

501

502

503

504

505

506

507

508

509

510

511

512

513

514

515

516

517

518

519

520

521

522

523

524

525

526

527

528

529

530

531

532

533

534

535

536

537

538

539

540

541

542

543

544

545

546

547

548

549

550

551

552

553

554

555

556

557

558

559

560

561

562

563

564

565

566

567

568

569

570

571

572

573

574

575

576

577

578

579

580

581

582

583

584

585

586

587

588

589

590

591

592

593

594

595

596

597

598

599

600

601

602

603

604

605

606

607

608

609

610

611

612

613

614

615

616

617

618

619

620

621

622

623

624

625

626

627

628

629

630

631

632

633

634

635

636

637

638

639

640

641

642

643

644

645

646

647

648

649

650

651

652

653

654

655

656

657

658

659

660

661

662

663

664

665

666

667

668

669

670

671

672

673

674

675

676

677

678

679

680

681

682

683

684

685

686

687

688

689

690

691

692

693

694

695

696

697

698

699

700

701

702

703

704

705

706

707

708

709

710

711

712

713

714

715

716

717

718

719

720

721

722

723

724

725

726

727

728

729

730

731

732

733

734

735

736

737

738

739

740

741

742

743

744

745

746

747

748

749

750

751

752

753

754

755

756

757

758

759

760

761

762

763

764

765

766

767

768

769

770

771

772

773

774

775

776

777

778

779

780

781

782

783

784

785

786

787

788

789

790

791

792

793

794

795

796

797

798

799

800

801

802

803

804

805

806

807

808

809

810

811

812

813

814

815

816

817

818

819

820

821

822

823

824

825

826

827

828

829

830

831

832

833

834

835

836

837

838

839

840

841

842

843

844

845

846

847

848

849

850

851

852

853

854

855

856

857

858

859

860

861

862

863

864

865

866

867

868

869

870

871

872

873

874

875

876

877

878

879

880

881

882

883

884

885

886

887

888

889

890

891

892

893

894

895

896

897

898

899

900

901

902

903

904

905

906

907

908

909

910

911

912

913

914

915

916

917

918

919

920

921

922

923

924

925

926

927

928

929

930

931

932

933

934

935

936

937

938

939

940

941

942

943

944

945

946

947

948

949

950

951

952

953

954

955

956

957

958

959

960

961

962

963

964

965

966

967

968

969

970

971

972

973

974

975

976

977

978

979

980

981

982

983

984

985

986

987

988

989

990

991

992

993

994

995

996

997

998

999

1000

1001

1002

1003

1004

1005

1006

1007

1008

1009

1010

1011

1012

1013

1014

1015

1016

1017

1018

1019

1020

1021

1022

1023

1024

1025

1026

1027

1028

1029

1030

1031

1032

1033

1034

1035

1036

1037

1038

1039

1040

1041

1042

1043

1044

1045

1046

1047

1048

1049

1050

1051

1052

1053

1054

1055

1056

1057

1058

1059

1060

1061

1062

1063

1064

1065

1066

1067

1068

1069

1070

1071

1072

1073

1074

1075

1076

1077

1078

1079

1080

1081

1082

1083

1084

1085

1086

1087

1088

1089

1090

1091

1092

1093

1094

1095

1096

1097

1098

1099

1100

1101

1102

1103

1104

1105

1106

1107

1108

1109

1110

1111

1112

1113

1114

1115

1116

1117

1118

1119

1120

1121

1122

1123

1124

1125

1126

1127

1128

1129

1130

1131

1132

1133

1134

1135

1136

1137

1138

1139

1140

1141

1142

1143

1144

1145

1146

1147

1148

1149

1150

1151

1152

1153

1154

1155

1156

1157

1158

1159

1160

1161

1162

1163

1164

1165

1166

1167

1168

1169

1170

1171

1172

1173

1174

1175

1176

1177

1178

1179

1180

1181

1182

1183

1184

1185

1186

1187

1188

1189

1190

1191

1192

1193

1194

1195

1196

1197

1198

1199

1200

1201

1202

1203

1204

1205

1206

1207

1208

1209

1210

1211

1212

1213

1214

1215

1216

1217

1218

1219

1220

1221

1222

1223

1224

1225

1226

1227

1228

1229

1230

1231

1232

1233

1234

1235

1236

1237

1238

1239

1240

1241

1242

1243

1244

1245

1246

1247

1248

1249

1250

1251

1252

1253

1254

1255

1256

1257

1258

1259

1260

1261

1262

1263

1264

1265

1266

1267

1268

1269

1270

1271

1272

1273

1274

1275

1276

1277

1278

1279

1280

1281

1282

1283

1284

1285

1286

1287

1288

1289

1290

1291

1292

1293

1294

1295

1296

1297

1298

1299

1300

1301

1302

1303

1304

1305

1306

1307

1308

1309

1310

1311

1312

1313

1314

1315

1316

1317

1318

1319

1320

1321

1322

1323

1324

1325

1326

1327

1328

1329

1330

1331

1332

1333

1334

1335

1336

1337

1338

1339

1340

1341

1342

1343

1344

1345

1346

1347

1348

1349

1350

1351

1352

1353

1354

1355

1356

1357

1358

1359

1360

1361

1362

1363

1364

1365

1366

1367

1368

1369

1370

1371

1372

1373

1374

1375

1376

1377

1378

1379

1380

1381

1382

1383

1384

1385

1386

1387

1388

1389

1390

1391

1392

1393

1394

1395

1396

1397

1398

1399

1400

1401

1402

1403

1404

1405

1406

1407

1408

1409

1410

1411

1412

1413

1414

1415

1416

1417

1418

1419

1420

1421

1422

1423

1424

1425

1426

1427

1428

1429

1430

1431

1432

1433

1434

1435

1436

1437

1438

1439

1440

1441

1442

1443

1444

1445

1446

1447

1448

1449

1450

1451

1452

1453

1454

1455

1456

1457

1458

1459

1460

1461

1462

1463

1464

1465

1466

1467

1468

1469

1470

1471

1472

1473

1474

1475

1476

1477

1478

1479

package com.twitter.home\_mixer.param

import com.twitter.conversions.DurationOps.\_

import com.twitter.home\_mixer.param.decider.DeciderKey

import com.twitter.timelines.configapi.DurationConversion

import com.twitter.timelines.configapi.FSBoundedParam

import com.twitter.timelines.configapi.FSEnumParam

import com.twitter.timelines.configapi.FSParam

import com.twitter.timelines.configapi.HasDurationConversion

import com.twitter.timelines.configapi.decider.BooleanDeciderParam

import com.twitter.timelines.configapi.decider.DeciderBoundedParam

import com.twitter.util.Duration

/\*\*

\* Instantiate Params that do not relate to a specific product.

\*

\* @see \[\[com.twitter.product\_mixer.core.product.ProductParamConfig.supportedClientFSName\]\]

\*/

object HomeGlobalParams {

/\*\*

\* This param is used to disable ads injection for timelines served by home-mixer.

\* It is currently used to maintain user-role based no-ads lists for automation accounts,

\* and should NOT be used for other purposes.

\*/

object AdsDisableInjectionBasedOnUserRoleParam

extends FSParam(

name \= "home\_mixer\_ads\_disable\_injection\_based\_on\_user\_role",

default \= false

)

object EnableTweetEntityServiceMigrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_tweet\_entity\_service\_migration",

default \= false

)

object EnableTweetEntityServiceVisibilityMigrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_tweet\_entity\_service\_visibility\_migration",

default \= false

)

object EnableSendScoresToClient

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_send\_scores\_to\_client",

default \= false

)

object EnableDebugString

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_debug\_string",

default \= false

)

object EnablePersistenceDebug

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_persistence\_debug",

default \= false

)

object MaxNumberReplaceInstructionsParam

extends FSBoundedParam\[Int\](

name \= "home\_mixer\_max\_number\_replace\_instructions",

default \= 10,

min \= 1,

max \= 20

)

object TimelinesPersistenceStoreMaxEntriesPerClient

extends FSBoundedParam\[Int\](

name \= "home\_mixer\_timelines\_persistence\_store\_max\_entries\_per\_client",

default \= 1800,

min \= 500,

max \= 5000

)

object EnableNewTweetsPillAvatarsParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_new\_tweets\_pill\_avatars",

default \= true

)

object EnableSocialContextParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_social\_context",

default \= false

)

object EnableCommunitiesContextParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_communities\_context",

default \= true

)

object EnableAdvertiserBrandSafetySettingsFeatureHydratorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_advertiser\_brand\_safety\_settings\_feature\_hydrator",

default \= true

)

object EnableBasketballContextFeatureHydratorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_basketball\_context\_feature\_hydrator",

default \= false

)

object EnablePostContextFeatureHydratorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_post\_context\_feature\_hydrator",

default \= false

)

object BasketballTeamAccountIdsParam

extends FSParam\[Set\[Long\]\](

name \= "home\_mixer\_basketball\_team\_account\_ids",

default \= Set()

)

object EnableSSPAdsBrandSafetySettingsFeatureHydratorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_ssp\_ads\_brand\_safety\_settings\_feature\_hydrator",

default \= true

)

object ExcludeServedTweetIdsNumberParam

extends FSBoundedParam\[Int\](

name \= "home\_mixer\_exclude\_served\_tweet\_ids\_number",

default \= 100,

min \= 0,

max \= 100

)

object ExcludeServedTweetIdsDurationParam

extends FSBoundedParam\[Duration\](

"home\_mixer\_exclude\_served\_tweet\_ids\_in\_minutes",

default \= 10.minutes,

min \= 1.minute,

max \= 60.minutes)

with HasDurationConversion {

override val durationConversion: DurationConversion \= DurationConversion.FromMinutes

}

object ExcludeServedAuthorIdsDurationParam

extends FSBoundedParam\[Duration\](

"home\_mixer\_exclude\_served\_author\_ids\_in\_minutes",

default \= 60.minutes,

min \= 1.minute,

max \= 60.minutes)

with HasDurationConversion {

override val durationConversion: DurationConversion \= DurationConversion.FromMinutes

}

object EnableServedFilterAllRequests

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_served\_filter\_all\_requests",

default \= false

)

object EnableScribeServedCandidatesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_served\_tweets\_enable\_scribing",

default \= false

)

object EnableServedCandidateFeatureKeysKafkaPublishingParam

extends BooleanDeciderParam(

decider \= DeciderKey.EnableServedCandidateFeatureKeysKafkaPublishing)

object RateLimitTestIdsParam

extends FSParam\[Set\[Long\]\](

name \= "home\_mixer\_rate\_limit\_test\_ids",

default \= Set.empty

)

object IsSelectedByHeavyRankerCountParam

extends FSBoundedParam\[Int\](

name \= "home\_mixer\_is\_selected\_by\_heavy\_ranker\_count",

default \= 100,

min \= 0,

max \= 2000

)

object EnableAdditionalChildFeedbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_additional\_child\_feedback",

default \= false

)

object EnableBlockMuteReportChildFeedbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_block\_mute\_report\_child\_feedback",

default \= false

)

object ListMandarinTweetsParams {

object ListMandarinTweetsEnable

extends FSParam\[Boolean\](

name \= "home\_mixer\_mandarin\_list\_tweets\_enabled",

default \= false

)

object ListMandarinTweetsLists

extends FSParam\[Seq\[Long\]\](

name \= "home\_mixer\_mandarin\_tweets\_lists",

default \= Seq.empty

)

}

object FeatureHydration {

object EnableLargeEmbeddingsFeatureHydrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_large\_embeddings",

default \= false

)

object EnableSimClustersSimilarityFeaturesDeciderParam

extends BooleanDeciderParam(

decider \= DeciderKey.EnableSimClustersSimilarityFeatureHydration

)

object EnableOnPremRealGraphQueryFeatures

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_on\_prem\_real\_graph\_query\_features",

default \= false

)

object EnableRealGraphQueryFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_real\_graph\_query\_features",

default \= false

)

object EnableRealGraphViewerRelatedUsersFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_real\_graph\_viewer\_related\_users\_features",

default \= false

)

object EnableSimclustersSparseTweetFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_simclusters\_sparse\_tweet\_features",

default \= false

)

object EnableTwhinUserPositiveFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_user\_positive\_features",

default \= false

)

object EnableTwhinVideoFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_video\_features",

default \= false

)

object EnableTwhinUserNegativeFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_user\_negative\_features",

default \= false

)

object EnableTwhinVideoFeaturesOnlineParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_video\_online\_features",

default \= false

)

object EnableTwhinRebuildUserEngagementFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_rebuild\_user\_engagement\_features",

default \= false

)

object EnableTwhinRebuildUserPositiveFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_rebuild\_user\_positive\_features",

default \= false

)

object EnableClipEmbeddingFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_clip\_embedding\_features",

default \= false

)

object EnableClipEmbeddingMediaUnderstandingFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_clip\_embedding\_media\_understanding\_features",

default \= false

)

object EnableUserHistoryTransformerJointBlueEmbeddingFeaturesParam

extends FSParam\[Boolean\](

name \=

"home\_mixer\_feature\_hydration\_enable\_user\_history\_transformer\_joint\_blue\_embedding\_features",

default \= false

)

object EnableTweetLanguageFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweet\_language\_features",

default \= false

)

object EnableTwhinTweetFeaturesOnlineParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_tweet\_online\_features",

default \= false

)

object EnableTwhinRebuildTweetFeaturesOnlineParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_twhin\_rebuild\_tweet\_online\_features",

default \= false

)

object EnableTransformerPostEmbeddingJointBlueFeaturesParam

extends FSParam\[Boolean\](

name \=

"home\_mixer\_feature\_hydration\_enable\_transformer\_post\_embedding\_features\_joint\_blue",

default \= false

)

object EnableTweetypieContentFeaturesDeciderParam

extends BooleanDeciderParam(

decider \= DeciderKey.EnableTweetypieContentFeatures

)

object EnableTweetypieContentFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweetypie\_content\_features",

default \= true

)

object EnableTweetypieContentMediaEntityFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweetypie\_content\_media\_entity\_features",

default \= true

)

object EnableUserFavAvgTextEmbeddingsQueryFeatureParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_user\_fav\_avg\_text\_embeddings\_query\_feature",

default \= false

)

object EnableTweetTextTokensEmbeddingFeatureScribingParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweet\_text\_tokens\_embedding\_feature\_scribing",

default \= false

)

object EnableTweetVideoAggregatedWatchTimeFeatureScribingParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweet\_video\_aggregated\_watch\_time",

default \= false

)

object EnableImmersiveClientActionsQueryFeatureHydrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_immersive\_client\_actions",

default \= false

)

object EnableImmersiveClientActionsClipEmbeddingQueryFeatureHydrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_immersive\_client\_actions\_clip\_embedding",

default \= false

)

object EnableGrokVideoMetadataFeatureHydrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_grok\_video\_metadata",

default \= false

)

object EnableDedupClusterIdFeatureHydrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_dedup\_cluster\_id",

default \= false

)

object EnableDedupClusterId88FeatureHydrationParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_dedup\_cluster\_id\_88",

default \= false

)

object EnableGeoduckAuthorLocationHydatorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_geoduck\_author\_location\_hydrator",

default \= false

)

object EnableViewCountFeaturesParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_view\_count\_features",

default \= false

)

object EnableVideoSummaryEmbeddingFeatureDeciderParam

extends BooleanDeciderParam(

decider \= DeciderKey.EnableVideoSummaryEmbeddingHydration

)

object EnableVideoClipEmbeddingFeatureHydrationDeciderParam

extends BooleanDeciderParam(

decider \= DeciderKey.EnableVideoClipEmbeddingHydration

)

object EnableScoredVideoTweetsUserHistoryEventsQueryFeatureHydrationDeciderParam

extends BooleanDeciderParam(

decider \=

DeciderKey.EnableScoredVideoTweetsUserHistoryEventsQueryFeatureHydrationDeciderParam

)

object EnableVideoClipEmbeddingMediaUnderstandingFeatureHydrationDeciderParam

extends BooleanDeciderParam(

decider \= DeciderKey.EnableVideoClipEmbeddingMediaUnderstandingHydration

)

}

object Scoring {

object AuthorListForDataCollectionParam

extends FSParam\[Set\[Long\]\](

name \= "home\_mixer\_author\_list\_for\_data\_collection",

default \= Set.empty\[Long\]

)

object ModelNameParam

extends FSParam\[String\](

name \= "home\_mixer\_model\_name",

default \= ""

)

object ImpressedMediaClusterBasedRescoringParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_impressed\_media\_cluster\_based\_rescoring",

default \= 0.0,

min \= 0.0,

max \= 0.2

)

object ImpressedImageClusterBasedRescoringParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_impressed\_image\_cluster\_based\_rescoring",

default \= 0.0,

min \= 0.0,

max \= 1.0

)

object ModelIdParam

extends FSParam\[String\](

name \= "home\_mixer\_model\_id",

default \= "Home"

)

object ProdModelIdParam

extends FSParam\[String\](

name \= "home\_mixer\_model\_prod\_model\_id",

default \= "Home"

)

object UseRealtimeNaviClusterParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_model\_use\_realtime\_navi\_cluster",

default \= false

)

object UseGPUNaviClusterParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_model\_use\_gpu\_navi\_cluster",

default \= false

)

object UseSecondaryNaviClusterParam

extends BooleanDeciderParam(decider \= DeciderKey.EnableSecondaryNaviRecapCluster)

object UseGPUNaviClusterTestUsersParam

extends BooleanDeciderParam(decider \= DeciderKey.EnableGPUNaviRecapClusterTestUsers)

object UseVideoNaviClusterParam

extends FSParam\[Boolean\]("home\_mixer\_model\_use\_video\_navi\_cluster", false)

object NaviGPUBatchSizeParam

extends DeciderBoundedParam\[Double\](

decider \= DeciderKey.NaviGPUClusterRequestBatchSize,

default \= 1800.0,

min \= 0.0,

max \= 10000.0

)

object AddNoiseInWeightsPerLabel

extends FSParam\[Boolean\](

name \= "home\_mixer\_add\_noise\_in\_weights\_per\_label",

default \= false

)

object EnableDailyFrozenNoisyWeights

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_daily\_frozen\_weights",

default \= false

)

object NoisyWeightAlphaParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_noisy\_weight\_alpha\_param",

default \= 2,

min \= 0.0,

max \= 10.0

)

object NoisyWeightBetaParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_noisy\_weight\_beta\_param",

default \= 2,

min \= 0.0,

max \= 10.0

)

object NegativeScoreConstantFilterThresholdParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_negative\_score\_constant\_filter\_threshold",

default \= 1e-3,

min \= 0,

max \= 1

)

object NegativeScoreNormFilterThresholdParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_negative\_score\_norm\_filter\_threshold",

default \= 0.15,

min \= 0,

max \= 1

)

object RequestNormalizedScoresParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_request\_normalized\_scores",

default \= false

)

object NormalizedNegativeHead

extends FSParam\[Boolean\](

name \= "home\_mixer\_normalized\_negative\_head",

default \= false

)

object UseWeightForNegHeadParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_use\_weight\_for\_neg\_head",

default \= false

)

object ConstantNegativeHead

extends FSParam\[Boolean\](

name \= "home\_mixer\_constant\_negative\_head",

default \= false

)

object EnableNoNegHeuristicParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_no\_neg\_heuristic",

default \= false

)

object EnableNegSectionRankingParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_neg\_section\_ranking",

default \= false

)

object RequestRankDecayFactorParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_request\_rank\_decay\_factor",

default \= 0.95,

min \= 0,

max \= 1

)

object ScoreThresholdForVQVParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_score\_threshold\_for\_vqv",

default \= 0.0,

min \= 0.0,

max \= 1.0

)

object ScoreThresholdForDwellParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_score\_threshold\_for\_dwell",

default \= 0.0,

min \= 0.0,

max \= 1.0

)

object EnableBinarySchemeForVQVParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_binary\_scheme\_for\_vqv",

default \= false

)

object BinarySchemeConstantForVQVParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_constant\_binary\_scheme\_for\_vqv",

default \= 0.0,

min \= 0.0,

max \= 1.0

)

object EnableBinarySchemeForDwellParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_binary\_scheme\_for\_dwell",

default \= false

)

object EnableDwellOrVQVParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_dwell\_or\_video\_watch\_time",

default \= false

)

object TwhinDiversityRescoringParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_twhin\_diversity\_rescoring",

default \= false

)

object CategoryDiversityRescoringParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_category\_diversity\_rescoring",

default \= false

)

object ModelBiases {

object VideoQualityViewParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_bias\_video\_quality\_viewed",

default \= 0.0,

min \= 0.0,

max \= 100.0

)

object VideoQualityViewImmersiveParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_bias\_video\_quality\_viewed\_immersive",

default \= 0.0,

min \= 0.0,

max \= 100.0

)

object VideoQualityWatchParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_bias\_video\_quality\_watched",

default \= 0.0,

min \= 0.0,

max \= 100.0

)

}

object ModelDebiases {

object FavParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_fav",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object RetweetParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_retweet",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ReplyParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_reply",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object DwellParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_dwell",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object GoodProfileClickParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_good\_profile\_click",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoWatchTimeMsParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_video\_watch\_time\_ms",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoQualityViewParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_video\_quality\_viewed",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoQualityViewImmersiveParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_video\_quality\_viewed\_immersive",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ReplyEngagedByAuthorParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_reply\_engaged\_by\_author",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object GoodClickV1Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_good\_click\_v1",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object GoodClickV2Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_good\_click\_v2",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object BookmarkParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_bookmark",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ShareParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_share",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object NegativeFeedbackV2Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_negative\_feedback\_v2",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoQualityWatchParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_debias\_video\_quality\_watched",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

}

object ModelWeights {

object FavParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_fav",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object RetweetParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_retweet",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ReplyParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_reply",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object GoodProfileClickParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_good\_profile\_click",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoPlayback50Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_video\_playback50",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoQualityViewParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_video\_quality\_viewed",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoQualityViewImmersiveParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_video\_quality\_viewed\_immersive",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ReplyEngagedByAuthorParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_reply\_engaged\_by\_author",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object GoodClickParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_good\_click",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object GoodClickV1Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_good\_click\_v1",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object GoodClickV2Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_good\_click\_v2",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object TweetDetailDwellParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_tweet\_detail\_dwell",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ProfileDwelledParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_profile\_dwelled",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object BookmarkParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_bookmark",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ShareParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_share",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ShareMenuClickParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_share\_menu\_click",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object NegativeFeedbackV2Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_negative\_feedback\_v2",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ReportParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_report",

default \= 0.0,

min \= \-20000.0,

max \= 0.0

)

object WeakNegativeFeedbackParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_weak\_negative\_feedback",

default \= 0.0,

min \= \-1000.0,

max \= 0.0

)

object StrongNegativeFeedbackParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_strong\_negative\_feedback",

default \= 0.0,

min \= \-1000.0,

max \= 0.0

)

object DwellParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_dwell",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object OpenLinkParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_open\_link",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object ScreenshotParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_screenshot",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

object VideoWatchTimeMsParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_video\_watch\_time\_ms",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

// Categorical Dwell Params

object Dwell0Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_dwell\_0",

default \= 0.0,

min \= 0.0,

max \= 1000.0

)

object Dwell1Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_dwell\_1",

default \= 0.0,

min \= 0.0,

max \= 1000.0

)

object Dwell2Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_dwell\_2",

default \= 0.0,

min \= 0.0,

max \= 1000.0

)

object Dwell3Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_dwell\_3",

default \= 0.0,

min \= 0.0,

max \= 1000.0

)

object Dwell4Param

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_dwell\_4",

default \= 0.0,

min \= 0.0,

max \= 1000.0

)

object VideoQualityWatchParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_model\_weight\_video\_quality\_watched",

default \= 0.0,

min \= \-10000.0,

max \= 10000.0

)

}

object UseProdInPhoenixParams {

object EnableProdFavForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_fav\_for\_phoenix",

default \= false

)

object EnableProdReplyForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_reply\_for\_phoenix",

default \= false

)

object EnableProdShareForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_share\_for\_phoenix",

default \= false

)

object EnableProdRetweetForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_retweet\_for\_phoenix",

default \= false

)

object EnableProdVQVForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_vqv\_for\_phoenix",

default \= false

)

object EnableProdDwellForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_dwell\_for\_phoenix",

default \= false

)

object EnableProdNegForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_neg\_for\_phoenix",

default \= false

)

object EnableProdProfileClickForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_profile\_click\_for\_phoenix",

default \= false

)

object EnableProdGoodClickV1ForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_good\_click\_v1\_for\_phoenix",

default \= false

)

object EnableProdGoodClickV2ForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_good\_click\_v2\_for\_phoenix",

default \= false

)

object EnableProdOpenLinkForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_open\_link\_for\_phoenix",

default \= false

)

object EnableProdScreenshotForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_screenshot\_for\_phoenix",

default \= false

)

object EnableProdBookmarkForPhoenixParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_prod\_bookmark\_for\_phoenix",

default \= false

)

}

}

object EnableTenSecondsLogicForVQV

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_ten\_seconds\_logic\_for\_vqv",

default \= true

)

object EnableImmersiveVQV

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_immersive\_vqv",

default \= false

)

object EnableLandingPage

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_landing\_page",

default \= false

)

object EnableExploreSimclustersLandingPage

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_explore\_simclusters\_landing\_page",

default \= false

)

object EnableTopicBasedRealTimeAggregateFeatureHydratorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_topic\_based\_real\_time\_aggregate\_feature\_hydrator\_param",

default \= true

)

object EnableTopicCountryBasedRealTimeAggregateFeatureHydratorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_topic\_country\_based\_real\_time\_aggregate\_feature\_hydrator\_param",

default \= true

)

object EnableTopicEdgeAggregateFeatureHydratorParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_topic\_edge\_aggregate\_feature\_hydrator\_param",

default \= true

)

object FeedbackFatigueFilteringDurationParam

extends FSBoundedParam\[Duration\](

name \= "home\_mixer\_feedback\_fatigue\_filtering\_duration\_in\_days",

default \= 14.days,

min \= 0.days,

max \= 100.days

)

with HasDurationConversion {

override val durationConversion: DurationConversion \= DurationConversion.FromDays

}

object EnableCommonFeaturesDataRecordCopyDuringPldrConversionParam

extends BooleanDeciderParam(

decider \= DeciderKey.EnableCommonFeaturesDataRecordCopyDuringPldrConversion)

object EnablePinnedTweetsCarouselParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_pinned\_tweets\_carousel",

default \= false

)

object EnablePostFeedbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_post\_feedback",

default \= false

)

object PostFeedbackThresholdParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_post\_feedback\_threshold",

default \= 0.0,

min \= 0.0,

max \= 1.0

)

object PostFeedbackPromptTitleParam

extends FSParam\[String\](

name \= "home\_mixer\_post\_feedback\_prompt\_title",

default \= "Are you interested in this post?"

)

object PostFeedbackPromptPositiveParam

extends FSParam\[String\](

name \= "home\_mixer\_post\_feedback\_prompt\_positive",

default \= "Yes"

)

object PostFeedbackPromptNegativeParam

extends FSParam\[String\](

name \= "home\_mixer\_post\_feedback\_prompt\_negative",

default \= "No"

)

object PostFeedbackPromptNeutralParam

extends FSParam\[String\](

name \= "home\_mixer\_post\_feedback\_prompt\_neutral",

default \= "Not sure"

)

object EnablePostFollowupParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_post\_followup",

default \= false

)

object EnablePostDetailsNegativeFeedbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_post\_details\_negative\_feedback",

default \= false

)

object PostFollowupThresholdParam

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_post\_followup\_threshold",

default \= 0.0,

min \= 0.0,

max \= 1.0

)

object EnableSlopFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_slop\_filter",

default \= false

)

object EnableNsfwFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_nsfw\_filter",

default \= false

)

object EnableSoftNsfwFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_soft\_nsfw\_filter",

default \= false

)

object EnableGrokSpamFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_grok\_spam\_filter",

default \= false

)

object EnableGrokViolentFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_grok\_violent\_filter",

default \= false

)

object EnableGrokGoreFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_grok\_gore\_filter",

default \= false

)

object EnableMinVideoDurationFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_min\_video\_duration\_filter",

default \= false

)

object EnableMaxVideoDurationFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_max\_video\_duration\_filter",

default \= false

)

object EnableClusterBasedDedupFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_cluster\_based\_dedup\_filter",

default \= false

)

object EnableCountryFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_country\_filter",

default \= false

)

object EnableRegionFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_region\_filter",

default \= false

)

object EnableHasMultipleMediaFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_has\_multiple\_media\_filter",

default \= false

)

object EnableClusterBased88DedupFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_cluster\_based\_88\_dedup\_filter",

default \= false

)

object EnableNoClusterFilter

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_no\_cluster\_filter",

default \= false

)

object DedupHistoricalEventsTimeWindowParam

extends FSBoundedParam\[Long\](

name \= "home\_mixer\_dedup\_historical\_events\_time\_window",

default \= 43200000L, // 12 \* 60 \* 60 \* 1000 = 12hrs in milliseconds

min \= 0L,

max \= 604800000L // 7 days

)

object MinVideoDurationThresholdParam

extends FSBoundedParam\[Long\](

name \= "home\_mixer\_min\_video\_duration\_threshold",

default \= 0L, // 0 second

min \= 0L,

max \= 604800000L // 7 days

)

object MaxVideoDurationThresholdParam

extends FSBoundedParam\[Long\](

name \= "home\_mixer\_max\_video\_duration\_threshold",

default \= 604800000L, // 7 days

min \= 0L,

max \= 604800000L // 7 days

)

object EnableSlopFilterLowSignalUsers

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_slop\_filter\_low\_signal\_users",

default \= false

)

object EnableSlopFilterEligibleUserStateParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_slop\_filter\_eligible\_user\_state\_param",

default \= true

)

object SlopMaxScore

extends FSBoundedParam\[Double\](

name \= "home\_mixer\_slop\_max\_score",

default \= 0.3,

min \= 0.0,

max \= 4.0

)

object SlopMinFollowers

extends FSBoundedParam\[Int\](

name \= "home\_mixer\_slop\_min\_followers",

default \= 100,

min \= 0,

max \= 10000000

)

object EnableGrokAnnotations

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_grok\_annotations",

default \= false

)

object UserActionsMaxCount

extends FSBoundedParam\[Int\](

name \= "home\_mixer\_user\_actions\_max\_count",

default \= 522,

min \= 0,

max \= 10000

)

object EnableTweetRTAMhOnlyParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweet\_rta\_read\_from\_mh",

default \= false

)

object EnableTweetRTAMhFallbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweet\_rta\_read\_fallback\_to\_mh",

default \= false

)

object EnableTweetCountryRTAMhOnlyParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweet\_country\_rta\_read\_from\_mh",

default \= false

)

object EnableTweetCountryRTAMhFallbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_tweet\_country\_rta\_read\_fallback\_to\_mh",

default \= false

)

object EnableUserRTAMhOnlyParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_user\_rta\_read\_from\_mh",

default \= false

)

object EnableUserRTAMhFallbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_user\_rta\_read\_fallback\_to\_mh",

default \= false

)

object EnableUserAuthorRTAMhOnlyParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_user\_author\_rta\_read\_from\_mh",

default \= false

)

object EnableUserAuthorRTAMhFallbackParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_feature\_hydration\_enable\_user\_author\_rta\_read\_fallback\_to\_mh",

default \= false

)

object MaxPostContextPostsPerRequest

extends FSParam\[Int\](

name \= "home\_mixer\_feature\_hydration\_max\_post\_context\_posts",

default \= 5

)

object MaxPostContextDuplicatesPerRequest

extends FSParam\[Int\](

name \= "home\_mixer\_feature\_hydration\_max\_post\_context\_duplicates",

default \= 2

)

object PhoenixCluster extends Enumeration {

val Prod \= Value

val Experiment1 \= Value

val Experiment2 \= Value

val Experiment3 \= Value

val Experiment4 \= Value

val Experiment5 \= Value

val Experiment6 \= Value

val Experiment7 \= Value

val Experiment8 \= Value

}

object PhoenixInferenceClusterParam

extends FSEnumParam\[PhoenixCluster.type\](

name \= "home\_mixer\_model\_phoenix\_inference\_cluster\_id",

default \= PhoenixCluster.Prod,

enum \= PhoenixCluster

)

object PhoenixTimeoutInMsParam

extends FSBoundedParam\[Int\](

name \= "home\_mixer\_model\_phoenix\_timeout\_in\_ms",

default \= 500,

min \= 10,

max \= 10000

)

object EnablePhoenixScorerParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_model\_enable\_phoenix\_scorer",

default \= false

)

object EnableUserActionsShadowScribeParam

extends FSParam\[Boolean\](

name \= "home\_mixer\_enable\_user\_actions\_shadow\_scribe",

default \= false

)

}

## Symbols

Close symbols

Find definitions and references for functions and other symbols in this file by clicking a symbol below or in the code.

r

-   mod

    com.twitter.home\_mixer.param

-   const

    durationConversion

-   const

    durationConversion

-   const

    durationConversion

-   const

    Prod

    -   const

        Experiment1

        -   const

            Experiment2

            -   const

                Experiment3

                -   const

                    Experiment4

                    -   const

                        Experiment5

                        -   const

                            Experiment6

                            -   const

                                Experiment7